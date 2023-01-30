import { Block, IWorkerStrategy, WorkerEvent } from 'resolution-service';

export class MyWorkerStrategy implements IWorkerStrategy {
  getLatestNetworkBlock(fromBlock: number): Promise<Block> {
    throw new Error('Method not implemented.');
  }
  getBlock(blockNumber: number): Promise<Block> {
    throw new Error('Method not implemented.');
  }
  getEvents(fromBlock: number, toBlock: number): Promise<WorkerEvent[]> {
    throw new Error('Method not implemented.');
  }
  processEvents(events: WorkerEvent[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
