import { Block, WorkerEvent } from './Types';

export interface IWorkerStrategy {
  // blokchain state
  getLatestNetworkBlock(): Promise<Block>;
  getBlock(blockNumber: number): Promise<Block>;

  // event processing
  getEvents(fromBlock: number, toBlock: number): Promise<WorkerEvent[]>;
  processEvents(events: WorkerEvent[]): Promise<void>;
}
