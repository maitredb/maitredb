import { runTaskInProcess, type WorkerTask } from '../worker-pool.js';

export default function run(task: WorkerTask): unknown {
  return runTaskInProcess(task);
}