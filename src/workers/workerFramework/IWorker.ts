export interface IWorker {
  run(): Promise<void>;
  resync(): Promise<void>;
}
