import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import {
  BaseWorker,
  IWorkerStrategy,
  WorkerConfig,
  WorkerError,
  WorkerEvent,
} from '.';
import { Blockchain } from '../../types/common';
import { WorkerRepository } from './WorkerRepository';

describe('BaseWorker', () => {
  const sandbox = sinon.createSandbox();
  let workerRepositoryMock: WorkerRepository;
  let workerStrategyMock: IWorkerStrategy;
  let worker: BaseWorker;
  const workerConfig: WorkerConfig = {
    handleReorgs: false,
    blockFetchLimit: 100,
    eventsStartingBlock: 0,
    maxReorgSize: 100,
    networkId: 0,
    blockchain: Blockchain.ETH,
  };
  let transactionSpy: sinon.SinonStub;
  let commitSpy: sinon.SinonStub;
  let rollbackSpy: sinon.SinonStub;

  beforeEach(() => {
    // setup basic mocks
    workerRepositoryMock = <WorkerRepository>{};
    workerRepositoryMock.saveLastMirroredBlock = sandbox.stub().resolves();
    workerRepositoryMock.getLatestMirroredBlock = sandbox.stub().resolves(0);
    workerRepositoryMock.getLatestMirroredBlockHash = sandbox
      .stub()
      .resolves('0');
    workerRepositoryMock.latestEventBlocks = sandbox
      .stub()
      .callsFake((num) =>
        Promise.resolve({ blockNumber: num, blockHash: `${num}` }),
      );
    workerRepositoryMock.cleanUpEvents = sandbox
      .stub()
      .resolves({ deleted: 0 });
    workerRepositoryMock.saveEvents = sandbox.stub().resolves();
    workerRepositoryMock.removeReverseResolutions = sandbox.stub().resolves();
    workerRepositoryMock.removeAllResolutionsForDomain = sandbox
      .stub()
      .resolves();
    workerRepositoryMock.findEventsForDomain = sandbox.stub().resolves([]);

    workerStrategyMock = <IWorkerStrategy>{};
    workerStrategyMock.getBlock = sandbox
      .stub()
      .callsFake((num) =>
        Promise.resolve({ blockNumber: num, blockHash: `${num}` }),
      );
    workerStrategyMock.getLatestNetworkBlock = sandbox
      .stub()
      .resolves({ blockNumber: 100, blockHash: '100' });
    workerStrategyMock.getEvents = sandbox.stub().resolves([]);
    workerStrategyMock.processEvents = sandbox.stub().resolves();

    transactionSpy = sandbox
      .stub(WorkerRepository, 'startTransaction')
      .resolves(workerRepositoryMock);
    sandbox
      .stub(WorkerRepository, 'getRepository')
      .resolves(workerRepositoryMock);
    rollbackSpy = sandbox
      .stub(WorkerRepository, 'rollbackTransaction')
      .resolves();
    commitSpy = sandbox.stub(WorkerRepository, 'commitTransaction').resolves();

    worker = new BaseWorker(workerConfig, workerStrategyMock);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('run', () => {
    describe('normal operation', () => {
      it('should run normally', async () => {
        await worker.run();

        expect(transactionSpy).to.have.been.calledOnceWith(
          workerConfig.blockchain,
          workerConfig.networkId,
        );
        // checks block heights
        expect(
          workerRepositoryMock.getLatestMirroredBlock,
        ).to.have.been.calledOnceWith();
        expect(
          workerStrategyMock.getLatestNetworkBlock,
        ).to.have.been.calledOnceWith();

        // pulls events
        expect(workerStrategyMock.getEvents).to.have.been.calledOnceWith(
          1,
          100,
        );
        expect(workerRepositoryMock.saveEvents).to.have.been.calledOnceWith([]);
        expect(workerStrategyMock.processEvents).to.have.been.calledOnceWith(
          [],
        );

        // saves status
        expect(
          workerRepositoryMock.saveLastMirroredBlock,
        ).to.have.been.calledOnceWith(100, '100');
        expect(commitSpy).to.have.been.calledOnceWith(workerConfig.blockchain);
      });

      it('should start from config if latest mirrored is zero', async () => {
        worker = new BaseWorker(
          { ...workerConfig, eventsStartingBlock: 57 },
          workerStrategyMock,
        );

        await worker.run();

        expect(transactionSpy).to.have.been.calledOnceWith(
          workerConfig.blockchain,
          workerConfig.networkId,
        );

        // pulls events from the right block
        expect(workerStrategyMock.getEvents).to.have.been.calledOnceWith(
          58,
          100,
        );

        // saves status
        expect(
          workerRepositoryMock.saveLastMirroredBlock,
        ).to.have.been.calledOnceWith(100, '100');
        expect(commitSpy).to.have.been.calledOnceWith(workerConfig.blockchain);
      });

      it('should pull, save and process events', async () => {
        const events = [
          {
            node: '0x01',
            type: 'NewURI',
          },
          {
            node: '0x01',
            type: 'Transfer',
          },
          {
            node: '0x01',
            type: 'Set',
          },
        ];
        workerStrategyMock.getEvents = sandbox.stub().resolves(events);

        await worker.run();

        expect(transactionSpy).to.have.been.calledOnceWith(
          workerConfig.blockchain,
          workerConfig.networkId,
        );

        // pulls events
        expect(workerStrategyMock.getEvents).to.have.been.calledOnceWith(
          1,
          100,
        );
        expect(workerRepositoryMock.saveEvents).to.have.been.calledOnceWith(
          events,
        );
        expect(workerStrategyMock.processEvents).to.have.been.calledOnceWith(
          events,
        );

        // saves status
        expect(
          workerRepositoryMock.saveLastMirroredBlock,
        ).to.have.been.calledOnceWith(100, '100');
        expect(commitSpy).to.have.been.calledOnceWith(workerConfig.blockchain);
      });

      it('should keep pulling events if there are more blocks', async () => {
        workerStrategyMock.getLatestNetworkBlock = sandbox
          .stub()
          .resolves({ blockNumber: 200, blockHash: '200' });

        await worker.run();

        expect(transactionSpy).to.have.been.calledOnceWith(
          workerConfig.blockchain,
          workerConfig.networkId,
        );

        // pulls events once
        expect(workerStrategyMock.getEvents).to.have.been.calledWith(1, 100);
        expect(
          workerRepositoryMock.saveLastMirroredBlock,
        ).to.have.been.calledWith(100, '100');

        // pulls events twice
        expect(workerStrategyMock.getEvents).to.have.been.calledWith(101, 200);
        expect(
          workerRepositoryMock.saveLastMirroredBlock,
        ).to.have.been.calledWith(200, '200');

        // commits once
        expect(commitSpy).to.have.been.calledOnceWith(workerConfig.blockchain);
      });

      it('should rollback on error', async () => {
        workerStrategyMock.getEvents = sandbox
          .stub()
          .rejects(new WorkerError(workerConfig.blockchain, 'testError'));

        await worker.run();

        expect(transactionSpy).to.have.been.calledOnceWith(
          workerConfig.blockchain,
          workerConfig.networkId,
        );
        expect(workerStrategyMock.getEvents).to.have.been.calledOnceWith(
          1,
          100,
        );

        // rollbacks
        expect(rollbackSpy).to.have.been.calledOnceWith(
          workerConfig.blockchain,
        );
      });
    });
  });

  describe('resync', () => {
    it('should delete events and update status', async () => {
      const fromBlock = 35;
      await worker.resync(fromBlock);

      expect(transactionSpy).to.have.been.calledOnceWith(
        workerConfig.blockchain,
        workerConfig.networkId,
      );
      // checks block heights
      expect(
        workerRepositoryMock.getLatestMirroredBlock,
      ).to.have.been.calledOnceWith();
      expect(workerStrategyMock.getBlock).to.have.been.calledOnceWith(
        fromBlock,
      );

      // deletes events
      expect(workerRepositoryMock.cleanUpEvents).to.have.been.calledOnceWith(
        fromBlock,
      );

      // saves status
      expect(
        workerRepositoryMock.saveLastMirroredBlock,
      ).to.have.been.calledOnceWith(fromBlock, `${fromBlock}`);
      expect(commitSpy).to.have.been.calledOnceWith(workerConfig.blockchain);
    });

    it('should rollback on eror', async () => {
      const fromBlock = 35;
      workerRepositoryMock.cleanUpEvents = sandbox
        .stub()
        .rejects(new WorkerError(workerConfig.blockchain, 'testError'));
      await worker.resync(fromBlock);

      expect(transactionSpy).to.have.been.calledOnceWith(
        workerConfig.blockchain,
        workerConfig.networkId,
      );
      // checks block heights
      expect(
        workerRepositoryMock.getLatestMirroredBlock,
      ).to.have.been.calledOnceWith();
      expect(workerStrategyMock.getBlock).to.have.been.calledOnceWith(
        fromBlock,
      );

      // tries to delete events
      expect(workerRepositoryMock.cleanUpEvents).to.have.been.calledOnceWith(
        fromBlock,
      );

      // rollbacks transaction
      expect(rollbackSpy).to.have.been.calledOnceWith(workerConfig.blockchain);
    });
  });
});
