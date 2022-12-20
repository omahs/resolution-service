import { IEvent } from './Types';

export abstract class IWorkerStrategy {
  abstract getEvents(fromBlock: number, toBlock: number): Promise<IEvent[]>;
  abstract handleEvent(event: IEvent): Promise<void>;
}
