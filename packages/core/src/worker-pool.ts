import { tableFromIPC } from 'apache-arrow';
import type { TransferListItem } from 'node:worker_threads';
import type { FieldInfo } from '@maitredb/plugin-api';
import { encodeRowsToArrowIPC } from '@maitredb/wire';

export interface FormatConversionTask {
  type: 'rows-to-arrow-ipc';
  rows: Record<string, unknown>[];
  fields: FieldInfo[];
}

export type WorkerTask = FormatConversionTask;

export interface WorkerPool {
  runTask(task: WorkerTask, transferList?: TransferListItem[]): Promise<unknown>;
  close(): Promise<void>;
}

export interface MaitreWorkerPoolOptions {
  minThreads?: number;
  maxThreads?: number;
  forceInProcess?: boolean;
}

type PiscinaInstance = {
  run(task: WorkerTask, options?: { transferList?: TransferListItem[] }): Promise<unknown>;
  destroy(): Promise<void>;
};

type PiscinaConstructor = new (options: {
  filename: string;
  minThreads?: number;
  maxThreads?: number;
}) => PiscinaInstance;

export class MaitreWorkerPool implements WorkerPool {
  private piscina: Promise<PiscinaInstance | undefined> | undefined;

  constructor(private readonly options: MaitreWorkerPoolOptions = {}) {}

  async runTask(task: WorkerTask, transferList: TransferListItem[] = []): Promise<unknown> {
    const piscina = await this.getPiscina();
    if (piscina) {
      return await piscina.run(task, { transferList });
    }

    return runTaskInProcess(task);
  }

  async close(): Promise<void> {
    const piscina = await this.piscina;
    await piscina?.destroy();
    this.piscina = undefined;
  }

  private async getPiscina(): Promise<PiscinaInstance | undefined> {
    if (this.options.forceInProcess) return undefined;
    this.piscina ??= createPiscina(this.options);
    return this.piscina;
  }
}

export async function convertRowsToRecordBatchWithWorker(
  pool: WorkerPool,
  rows: Record<string, unknown>[],
  fields: FieldInfo[],
) {
  const ipc = await pool.runTask({ type: 'rows-to-arrow-ipc', rows, fields }) as ArrayBuffer;
  return tableFromIPC(ipc).batches[0]!;
}

export function runTaskInProcess(task: WorkerTask): unknown {
  switch (task.type) {
    case 'rows-to-arrow-ipc':
      return encodeRowsToArrowIPC(task.rows, task.fields);
  }
}

async function createPiscina(options: MaitreWorkerPoolOptions): Promise<PiscinaInstance | undefined> {
  try {
    const imported = await import('piscina');
    const Piscina = ((imported as { default?: unknown; Piscina?: unknown }).default
      ?? (imported as { Piscina?: unknown }).Piscina) as PiscinaConstructor;
    return new Piscina({
      filename: new URL('./workers/format-worker.js', import.meta.url).href,
      minThreads: options.minThreads,
      maxThreads: options.maxThreads,
    }) as PiscinaInstance;
  } catch {
    return undefined;
  }
}