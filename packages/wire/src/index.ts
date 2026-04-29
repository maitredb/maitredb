import { Buffer } from 'node:buffer';
import { tableFromArrays, tableToIPC } from 'apache-arrow';
import type { FieldInfo, MaitreType } from '@maitredb/plugin-api';
import { loadNativeBinding } from './native-loader.js';

export interface WireColumn {
  name: string;
  type?: MaitreType;
  nativeType?: string;
}

export interface WireImplementationInfo {
  native: boolean;
  implementation: 'native' | 'js-fallback';
}

const nativeBinding = loadNativeBinding();

export function nativeAvailable(): boolean {
  return typeof nativeBinding?.nativeAvailable === 'function' ? nativeBinding.nativeAvailable() : false;
}

export function getWireImplementation(): WireImplementationInfo {
  return nativeAvailable()
    ? { native: true, implementation: 'native' }
    : { native: false, implementation: 'js-fallback' };
}

export function parsePostgresBinary(
  rawProtocolBytes: Uint8Array | ArrayBuffer,
  columns: WireColumn[],
): ArrayBuffer {
  if (nativeBinding?.parsePostgresBinary) {
    return toArrayBuffer(nativeBinding.parsePostgresBinary(rawProtocolBytes, columns));
  }

  const rows = parsePostgresDataRows(rawProtocolBytes, columns, 'binary');
  return encodeRowsToArrowIPC(rows, columnsToFields(columns));
}

export function parsePostgresText(
  rawProtocolBytes: Uint8Array | ArrayBuffer,
  columns: WireColumn[],
): ArrayBuffer {
  if (nativeBinding?.parsePostgresText) {
    return toArrayBuffer(nativeBinding.parsePostgresText(rawProtocolBytes, columns));
  }

  const rows = parsePostgresDataRows(rawProtocolBytes, columns, 'text');
  return encodeRowsToArrowIPC(rows, columnsToFields(columns));
}

export function parseMysqlBinary(
  rawProtocolBytes: Uint8Array | ArrayBuffer,
  columns: WireColumn[],
): ArrayBuffer {
  if (nativeBinding?.parseMysqlBinary) {
    return toArrayBuffer(nativeBinding.parseMysqlBinary(rawProtocolBytes, columns));
  }

  const buffer = toBuffer(rawProtocolBytes);
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const packetLength = readMysqlPacketLength(buffer, offset);
    const payloadOffset = packetLength === undefined ? offset : offset + 4;
    const payloadLength = packetLength ?? buffer.length - offset;
    const nextOffset = packetLength === undefined ? buffer.length : payloadOffset + payloadLength;
    rows.push(parseMysqlBinaryRow(buffer.subarray(payloadOffset, nextOffset), columns));
    offset = nextOffset;
  }

  return encodeRowsToArrowIPC(rows, columnsToFields(columns));
}

export function encodeRowsToArrowIPC(
  rows: Record<string, unknown>[],
  fields: readonly FieldInfo[],
): ArrayBuffer {
  const names = fields.length > 0
    ? fields.map((field) => field.name)
    : Object.keys(rows[0] ?? {});
  const arrays: Record<string, unknown[]> = {};

  for (const name of names) {
    arrays[name] = rows.map((row) => row[name] ?? null);
  }

  const table = tableFromArrays(arrays);
  return toArrayBuffer(tableToIPC(table));
}

function parsePostgresDataRows(
  rawProtocolBytes: Uint8Array | ArrayBuffer,
  columns: WireColumn[],
  format: 'binary' | 'text',
): Record<string, unknown>[] {
  const buffer = toBuffer(rawProtocolBytes);
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const messageType = buffer[offset];
    let bodyOffset = offset;
    let bodyLength = buffer.length - offset;

    if (messageType === 0x44) {
      if (offset + 5 > buffer.length) throw new Error('Truncated PostgreSQL DataRow header');
      const messageLength = buffer.readInt32BE(offset + 1);
      bodyOffset = offset + 5;
      bodyLength = messageLength - 4;
      offset = bodyOffset + bodyLength;
    } else {
      offset = buffer.length;
    }

    const body = buffer.subarray(bodyOffset, bodyOffset + bodyLength);
    rows.push(parsePostgresDataRowBody(body, columns, format));
  }

  return rows;
}

function parsePostgresDataRowBody(
  body: Buffer,
  columns: WireColumn[],
  format: 'binary' | 'text',
): Record<string, unknown> {
  if (body.length < 2) throw new Error('Truncated PostgreSQL DataRow body');
  const columnCount = body.readInt16BE(0);
  if (columnCount !== columns.length) {
    throw new Error(`PostgreSQL DataRow column count mismatch: expected ${columns.length}, received ${columnCount}`);
  }

  const row: Record<string, unknown> = {};
  let offset = 2;

  for (let index = 0; index < columns.length; index++) {
    if (offset + 4 > body.length) throw new Error('Truncated PostgreSQL column length');
    const valueLength = body.readInt32BE(offset);
    offset += 4;

    if (valueLength === -1) {
      row[columns[index]!.name] = null;
      continue;
    }

    if (offset + valueLength > body.length) throw new Error('Truncated PostgreSQL column value');
    const value = body.subarray(offset, offset + valueLength);
    row[columns[index]!.name] = format === 'binary'
      ? decodeBinaryValue(value, columns[index]!)
      : coerceTextValue(value.toString('utf8'), columns[index]!);
    offset += valueLength;
  }

  return row;
}

function parseMysqlBinaryRow(payload: Buffer, columns: WireColumn[]): Record<string, unknown> {
  if (payload.length === 0 || payload[0] !== 0x00) {
    throw new Error('Expected MySQL binary row packet with 0x00 header');
  }

  const nullBitmapLength = Math.floor((columns.length + 7 + 2) / 8);
  const nullBitmapOffset = 1;
  let offset = nullBitmapOffset + nullBitmapLength;
  const row: Record<string, unknown> = {};

  for (let index = 0; index < columns.length; index++) {
    const bitIndex = index + 2;
    const isNull = (payload[nullBitmapOffset + Math.floor(bitIndex / 8)]! & (1 << (bitIndex % 8))) !== 0;
    const column = columns[index]!;

    if (isNull) {
      row[column.name] = null;
      continue;
    }

    const decoded = decodeMysqlBinaryValue(payload, offset, column);
    row[column.name] = decoded.value;
    offset = decoded.nextOffset;
  }

  return row;
}

function decodeMysqlBinaryValue(
  payload: Buffer,
  offset: number,
  column: WireColumn,
): { value: unknown; nextOffset: number } {
  const nativeType = (column.nativeType ?? '').toLowerCase();
  const type = column.type ?? typeFromNative(nativeType);

  if (type === 'boolean' || nativeType === 'tinyint(1)') {
    return { value: payload.readUInt8(offset) !== 0, nextOffset: offset + 1 };
  }

  if (type === 'integer') {
    if (nativeType.includes('bigint')) {
      return { value: payload.readBigInt64LE(offset).toString(), nextOffset: offset + 8 };
    }
    if (nativeType.includes('smallint')) {
      return { value: payload.readInt16LE(offset), nextOffset: offset + 2 };
    }
    if (nativeType.includes('tinyint')) {
      return { value: payload.readInt8(offset), nextOffset: offset + 1 };
    }
    return { value: payload.readInt32LE(offset), nextOffset: offset + 4 };
  }

  if (type === 'float' || type === 'number' || type === 'decimal') {
    if (nativeType.includes('float')) {
      return { value: payload.readFloatLE(offset), nextOffset: offset + 4 };
    }
    if (nativeType.includes('double')) {
      return { value: payload.readDoubleLE(offset), nextOffset: offset + 8 };
    }
  }

  const length = readLengthEncodedInteger(payload, offset);
  const valueOffset = length.nextOffset;
  const nextOffset = valueOffset + length.value;
  const bytes = payload.subarray(valueOffset, nextOffset);
  return { value: type === 'binary' ? bytes : coerceTextValue(bytes.toString('utf8'), column), nextOffset };
}

function decodeBinaryValue(value: Buffer, column: WireColumn): unknown {
  const nativeType = (column.nativeType ?? '').toLowerCase();
  const type = column.type ?? typeFromNative(nativeType);

  if (type === 'boolean') return value[0] === 1;
  if (type === 'integer') {
    if (value.length === 2) return value.readInt16BE(0);
    if (value.length === 4) return value.readInt32BE(0);
    if (value.length === 8) return value.readBigInt64BE(0).toString();
  }
  if (type === 'float' || type === 'number') {
    if (value.length === 4) return value.readFloatBE(0);
    if (value.length === 8) return value.readDoubleBE(0);
  }
  if (type === 'binary') return value;

  return coerceTextValue(value.toString('utf8'), column);
}

function coerceTextValue(value: string, column: WireColumn): unknown {
  const nativeType = (column.nativeType ?? '').toLowerCase();
  const type = column.type ?? typeFromNative(nativeType);

  if (type === 'boolean') return value === 't' || value === 'true' || value === '1';
  if (type === 'integer') {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) ? parsed : value;
  }
  if (type === 'float' || type === 'number' || type === 'decimal') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (type === 'json' || type === 'array') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function readMysqlPacketLength(buffer: Buffer, offset: number): number | undefined {
  if (offset + 4 > buffer.length) return undefined;
  const packetLength = buffer[offset]! | (buffer[offset + 1]! << 8) | (buffer[offset + 2]! << 16);
  const sequenceId = buffer[offset + 3]!;
  if (packetLength <= 0 || offset + 4 + packetLength > buffer.length || sequenceId > 255) return undefined;
  return packetLength;
}

function readLengthEncodedInteger(buffer: Buffer, offset: number): { value: number; nextOffset: number } {
  const first = buffer[offset]!;
  if (first < 0xfb) return { value: first, nextOffset: offset + 1 };
  if (first === 0xfc) return { value: buffer.readUInt16LE(offset + 1), nextOffset: offset + 3 };
  if (first === 0xfd) {
    return {
      value: buffer[offset + 1]! | (buffer[offset + 2]! << 8) | (buffer[offset + 3]! << 16),
      nextOffset: offset + 4,
    };
  }
  if (first === 0xfe) return { value: Number(buffer.readBigUInt64LE(offset + 1)), nextOffset: offset + 9 };

  throw new Error('Unexpected NULL marker in non-null MySQL binary value');
}

function typeFromNative(nativeType: string): MaitreType {
  if (/bool|boolean|tinyint\(1\)/.test(nativeType)) return 'boolean';
  if (/int|serial|bigserial/.test(nativeType)) return 'integer';
  if (/float|double|real/.test(nativeType)) return 'float';
  if (/decimal|numeric/.test(nativeType)) return 'decimal';
  if (/json/.test(nativeType)) return 'json';
  if (/bytea|blob|binary|varbinary/.test(nativeType)) return 'binary';
  if (/date$/.test(nativeType)) return 'date';
  if (/timestamp/.test(nativeType)) return 'timestamp';
  if (/time/.test(nativeType)) return 'time';
  return 'string';
}

function columnsToFields(columns: WireColumn[]): FieldInfo[] {
  return columns.map((column) => ({
    name: column.name,
    nativeType: column.nativeType ?? column.type ?? 'unknown',
    type: column.type ?? typeFromNative(column.nativeType ?? ''),
  }));
}

function toBuffer(bytes: Uint8Array | ArrayBuffer): Buffer {
  return Buffer.isBuffer(bytes)
    ? bytes
    : bytes instanceof ArrayBuffer
      ? Buffer.from(bytes)
      : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function toArrayBuffer(bytes: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}