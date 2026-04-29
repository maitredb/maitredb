import { describe, expect, it } from 'vitest';
import { tableFromIPC } from 'apache-arrow';
import { MaitreWorkerPool, convertRowsToRecordBatchWithWorker, runTaskInProcess } from '../worker-pool.js';

describe('MaitreWorkerPool', () => {
  it('runs format conversion in the in-process fallback with Arrow IPC output', () => {
    const ipc = runTaskInProcess({
      type: 'rows-to-arrow-ipc',
      rows: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }],
      fields: [
        { name: 'id', nativeType: 'int4', type: 'integer' },
        { name: 'name', nativeType: 'text', type: 'string' },
      ],
    }) as ArrayBuffer;

    const table = tableFromIPC(ipc);
    expect(table.numRows).toBe(2);
    expect(table.getChild('name')?.get(1)).toBe('Grace');
  });

  it('converts row objects to RecordBatch through the worker pool interface', async () => {
    const pool = new MaitreWorkerPool({ forceInProcess: true });

    const batch = await convertRowsToRecordBatchWithWorker(pool, [
      { id: 10, ok: true },
      { id: 11, ok: false },
    ], [
      { name: 'id', nativeType: 'int4', type: 'integer' },
      { name: 'ok', nativeType: 'bool', type: 'boolean' },
    ]);

    expect(batch.numRows).toBe(2);
    expect(batch.getChild('id')?.get(0)).toBe(10);
    expect(batch.getChild('ok')?.get(1)).toBe(false);
    await pool.close();
  });
});