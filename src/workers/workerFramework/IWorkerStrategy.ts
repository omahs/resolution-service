import { Block } from './Types';
import { Event } from 'ethers';

export interface IWorkerStrategy {
  // blokchain state
  getLatestNetworkBlock(): Promise<Block>;
  getBlock(blockNumber: number): Promise<Block>;

  // event processing
  getEvents(fromBlock: number, toBlock: number): Promise<Event[]>;
  processEvents(events: Event[]): Promise<void>;
}
