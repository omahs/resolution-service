import { MyWorkerStrategy } from '../strategies/MyWorkerStrategy';
import { BaseWorker } from 'resolution-service';

// TODO: potentially clean this up, maybe wrap in a class?
export default (config: any) => {
  // TODO: pass strategy configs here, do some worker configuration or create a custom worker
  return new BaseWorker(config, new MyWorkerStrategy());
};
