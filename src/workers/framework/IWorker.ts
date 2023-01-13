export interface IWorker {
  run(): Promise<void>;
  resync(fromBlock: number): Promise<void>;
}
