import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { tableFromIPC } from 'apache-arrow';
import {
  encodeRowsToArrowIPC,
  getWireImplementation,
  nativeAvailable,
  parseMysqlBinary,
  parsePostgresBinary,
  parsePostgresText,
  type WireColumn,
} from '../index.js';

describe('@maitredb/wire JS fallback', () => {
  it('reports a usable implementation when native prebuilds are absent', () => {
    expect(nativeAvailable()).toBe(false);
    expect(getWireImplementation()).toEqual({ native: false, implementation: 'js-fallback' });
  });

  it('parses PostgreSQL binary DataRow messages into Arrow IPC', () => {
    const columns: WireColumn[] = [
      { name: 'id', type: 'integer', nativeType: 'int4' },
      { name: 'total', type: 'float', nativeType: 'float8' },
      { name: 'active', type: 'boolean', nativeType: 'bool' },
      { name: 'name', type: 'string', nativeType: 'text' },
    ];
    const ipc = parsePostgresBinary(Buffer.concat([
      pgDataRow([
        int32be(42),
        float64be(19.5),
        Buffer.from([1]),
        Buffer.from('Ada'),
      ]),
      pgDataRow([
        int32be(43),
        float64be(7.25),
        Buffer.from([0]),
        null,
      ]),
    ]), columns);

    const table = tableFromIPC(ipc);
    expect(table.numRows).toBe(2);
    expect(table.getChild('id')?.get(0)).toBe(42);
    expect(table.getChild('total')?.get(1)).toBe(7.25);
    expect(table.getChild('active')?.get(0)).toBe(true);
    expect(table.getChild('name')?.get(1)).toBeNull();
  });

  it('parses PostgreSQL text DataRows with type coercion', () => {
    const columns: WireColumn[] = [
      { name: 'id', type: 'integer' },
      { name: 'payload', type: 'json' },
    ];
    const ipc = parsePostgresText(pgDataRow([
      Buffer.from('7'),
      Buffer.from('{"ok":true}'),
    ]), columns);

    const table = tableFromIPC(ipc);
    expect(table.getChild('id')?.get(0)).toBe(7);
    expect(table.getChild('payload')?.get(0)?.toJSON()).toEqual({ ok: true });
  });

  it('parses MySQL binary row packets including null bitmap and length-coded strings', () => {
    const columns: WireColumn[] = [
      { name: 'id', type: 'integer', nativeType: 'int' },
      { name: 'enabled', type: 'boolean', nativeType: 'tinyint(1)' },
      { name: 'name', type: 'string', nativeType: 'varchar' },
      { name: 'missing', type: 'string', nativeType: 'varchar' },
    ];
    const payload = Buffer.concat([
      Buffer.from([0x00, 0b0010_0000]),
      int32le(99),
      Buffer.from([1]),
      lengthEncodedString('Grace'),
    ]);
    const packet = Buffer.concat([Buffer.from([payload.length, 0, 0, 1]), payload]);
    const ipc = parseMysqlBinary(packet, columns);

    const table = tableFromIPC(ipc);
    expect(table.numRows).toBe(1);
    expect(table.getChild('id')?.get(0)).toBe(99);
    expect(table.getChild('enabled')?.get(0)).toBe(true);
    expect(table.getChild('name')?.get(0)).toBe('Grace');
    expect(table.getChild('missing')?.get(0)).toBeNull();
  });

  it('encodes row objects into Arrow IPC using provided field order', () => {
    const ipc = encodeRowsToArrowIPC([
      { b: 'second', a: 1, ignored: true },
    ], [
      { name: 'a', nativeType: 'int4', type: 'integer' },
      { name: 'b', nativeType: 'text', type: 'string' },
    ]);

    const table = tableFromIPC(ipc);
    expect(table.schema.fields.map((field) => field.name)).toEqual(['a', 'b']);
    expect(table.getChild('a')?.get(0)).toBe(1);
    expect(table.getChild('b')?.get(0)).toBe('second');
  });
});

function pgDataRow(values: Array<Buffer | null>): Buffer {
  const parts = [int16be(values.length)];
  for (const value of values) {
    if (value === null) {
      parts.push(int32be(-1));
    } else {
      parts.push(int32be(value.length), value);
    }
  }

  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from('D'), int32be(body.length + 4), body]);
}

function lengthEncodedString(value: string): Buffer {
  const body = Buffer.from(value);
  return Buffer.concat([Buffer.from([body.length]), body]);
}

function int16be(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeInt16BE(value);
  return buffer;
}

function int32be(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value);
  return buffer;
}

function int32le(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value);
  return buffer;
}

function float64be(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeDoubleBE(value);
  return buffer;
}