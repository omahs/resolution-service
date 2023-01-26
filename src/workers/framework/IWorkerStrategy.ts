import { Block, WorkerEvent } from './Types';

export interface IWorkerStrategy {
  /**
   * Used to get the latest confirmed network block *up to* which sync should happen
   * @param fromBlock last synched block which will be the start of sync
   * @returns `Block` from the network
   */
  getLatestNetworkBlock(fromBlock: number): Promise<Block>;
  /**
   * Used to get specific blocks from the network for reorg handling.
   * @param blockNumber block number to get
   * @returns `Block` from the network
   */
  getBlock(blockNumber: number): Promise<Block>;

  /**
   * Used to get events from a range of blocks.
   * @param fromBlock starting block of the range (inclusive)
   * @param toBlock ending block of the range (inclusive)
   * @returns `WorkerEvent[]` events parsed from the network
   */
  getEvents(fromBlock: number, toBlock: number): Promise<WorkerEvent[]>;

  /**
   * Used to handle network events to save domains and resolutions.
   * @param events a list of events to process
   */
  processEvents(events: WorkerEvent[]): Promise<void>;
}
