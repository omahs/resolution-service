import { expect } from 'chai';
import { SinonStub } from 'sinon';
import sinon from 'sinon';
import { getEthConfig } from '../../contracts';
import { env } from '../../env';
import { Blockchain } from '../../types/common';
import { Domain, Resolution, WorkerEvent } from '../framework';
import { WorkerRepository } from '../framework/WorkerRepository';
import { GetProviderForConfig } from './EthereumProvider';
import { UNSWorkerStrategy } from './UnsWorkerStrategy';
import { ExecutionRevertedError } from './BlockchainErrors';

describe('UnsWorkerStrategy', () => {
  const sandbox = sinon.createSandbox();
  let strategy: UNSWorkerStrategy;

  beforeEach(() => {});

  afterEach(() => {
    sandbox.restore();
  });

  describe('processEvents', () => {
    let workerRepositoryMock: WorkerRepository;
    const testName = 'test.crypto';
    const testNode =
      '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103';
    const testOwner = '0xdeadcafe';
    const testBlockchain = Blockchain.ETH;
    const testNetworkId = env.APPLICATION.ETHEREUM.NETWORK_ID;

    beforeEach(() => {
      // setup basic mocks
      workerRepositoryMock = <WorkerRepository>{};
      workerRepositoryMock.saveDomains = sandbox.stub().resolves();
      workerRepositoryMock.saveResolutions = sandbox.stub().resolves();
      workerRepositoryMock.saveReverseResolutions = sandbox.stub().resolves();
      workerRepositoryMock.removeReverseResolutions = sandbox.stub().resolves();

      sandbox
        .stub(WorkerRepository, 'getRepository')
        .returns(workerRepositoryMock);

      // reject in functions that should not be called
      sandbox.stub(WorkerRepository, 'startTransaction').rejects();
      sandbox.stub(WorkerRepository, 'rollbackTransaction').rejects();
      sandbox.stub(WorkerRepository, 'commitTransaction').rejects();

      strategy = new UNSWorkerStrategy(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM,
      );
    });

    describe('Transfer', () => {
      let basicEvents: WorkerEvent[];
      let testUnsRegistryAddress: string;

      beforeEach(() => {
        const provider = GetProviderForConfig(env.APPLICATION.ETHEREUM);
        const cryptoConfig = getEthConfig(testNetworkId.toString(), provider);
        testUnsRegistryAddress =
          cryptoConfig.UNSRegistry.getContract().address.toLowerCase();

        basicEvents = [
          {
            node: testNode,
            type: 'Transfer',
            args: {
              from: '0xbeefcafe',
              to: testOwner,
            },
          },
        ];
      });

      it('should handle transfers', async () => {
        await strategy.processEvents(basicEvents);

        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
            ownerAddress: testOwner,
          }),
        );
      });
      it('should handle transfers to null address (burn)', async () => {
        basicEvents[0].args = {
          from: testOwner,
          to: Domain.NullAddress,
        };

        await strategy.processEvents(basicEvents);

        const expected = new Resolution({
          node: testNode,
          blockchain: testBlockchain,
          networkId: testNetworkId,
          ownerAddress: Domain.NullAddress,
          resolver: null,
          registry: null,
        });
        expected.resolution = undefined;
        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(expected);
      });
      it('should handle transfers from null address (mint or bridge)', async () => {
        basicEvents[0].args = {
          from: Domain.NullAddress,
          to: testOwner,
        };
        basicEvents[0].source = {
          attributes: {
            contractAddress: testUnsRegistryAddress,
          },
        };

        await strategy.processEvents(basicEvents);

        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
            ownerAddress: testOwner,
            registry: testUnsRegistryAddress,
            resolver: testUnsRegistryAddress,
          }),
        );
      });
    });

    describe('NewURI', () => {
      let basicEvents: WorkerEvent[];
      let testUnsRegistryAddress: string;
      let testCnsRegistryAddress: string;

      beforeEach(() => {
        const provider = GetProviderForConfig(env.APPLICATION.ETHEREUM);
        const cryptoConfig = getEthConfig(testNetworkId.toString(), provider);
        testUnsRegistryAddress =
          cryptoConfig.UNSRegistry.getContract().address.toLowerCase();
        testCnsRegistryAddress = cryptoConfig.CNSRegistry.getContract().address; // for some reason we don't lowercase cns registry address

        basicEvents = [
          {
            node: testNode,
            type: 'Transfer',
            args: {
              from: Domain.NullAddress,
              to: testOwner,
            },
          },
          {
            node: testNode,
            type: 'NewURI',
            args: {
              uri: testName,
            },
            source: {
              attributes: {
                contractAddress: testUnsRegistryAddress,
              },
            },
          },
        ];
      });

      it('should handle minted domain', async () => {
        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveDomains).to.have.been.calledOnceWith({
          name: testName,
          node: testNode,
        });

        expect(workerRepositoryMock.saveResolutions).to.have.been.calledWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
            ownerAddress: testOwner,
            registry: testUnsRegistryAddress,
            resolver: testUnsRegistryAddress,
          }),
        );
      });

      it('should set registry for cns domain', async () => {
        basicEvents[0].source = {
          attributes: {
            contractAddress: testCnsRegistryAddress,
          },
        };
        basicEvents[1].source = {
          attributes: {
            contractAddress: testCnsRegistryAddress,
          },
        };

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveDomains).to.have.been.calledOnceWith({
          name: testName,
          node: testNode,
        });

        expect(workerRepositoryMock.saveResolutions).to.have.been.calledWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
            ownerAddress: testOwner,
            registry: testCnsRegistryAddress,
          }),
        );
      });

      it('should not save with empty args', async () => {
        basicEvents[1].args = undefined;

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveDomains).to.have.not.been.called;
      });
      it('should not save mismatched node', async () => {
        basicEvents[1].node = '0x0';

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveDomains).to.have.not.been.called;
      });
      it('should not save if last processed event is not transfer from null', async () => {
        basicEvents[0].args = {
          from: '0xdeadcafe',
          to: '0xdeadcafe',
        };

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveDomains).to.have.not.been.called;
      });
    });

    describe('Set', () => {
      let basicEvents: WorkerEvent[];

      beforeEach(() => {
        basicEvents = [
          {
            node: testNode,
            type: 'Set',
            args: {
              '3': 'some.key',
              '4': 'myvalue',
            },
          },
        ];
      });

      it('should set key value', async () => {
        await strategy.processEvents(basicEvents);

        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
            resolution: {
              'some.key': 'myvalue',
            },
          }),
        );
      });

      it('should not save if args are missing', async () => {
        basicEvents[0].args = undefined;

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveResolutions).to.not.have.been.called;
      });
    });

    describe('ResetRecords', () => {
      it('should reset records', async () => {
        await strategy.processEvents([
          {
            node: testNode,
            type: 'ResetRecords',
          },
        ]);

        const expected = new Resolution({
          node: testNode,
          blockchain: testBlockchain,
          networkId: testNetworkId,
        });
        expected.resolution = undefined;

        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(expected);
      });
    });

    describe('Resolve', () => {
      it('should call fetch resolver', async () => {
        const cnsResolverMock = sandbox
          .stub(strategy['cnsResolver'], 'fetchResolver')
          .resolves();

        await strategy.processEvents([
          {
            node: testNode,
            type: 'Resolve',
          },
        ]);

        expect(cnsResolverMock).to.have.been.calledOnceWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
          }),
        );
      });
    });

    describe('Sync', () => {
      let basicEvents: WorkerEvent[];
      let cnsResolverAddressMock: SinonStub;
      let cnsResolverRecordsMock: SinonStub;
      const testKey = 'test.key';
      const testValue = 'value';

      beforeEach(() => {
        basicEvents = [
          {
            node: testNode,
            type: 'Sync',
            args: {
              updateId: '0x01',
            },
          },
        ];

        cnsResolverAddressMock = sandbox
          .stub(strategy['cnsResolver'], 'getResolverAddress')
          .resolves('0x013370');
        cnsResolverRecordsMock = sandbox
          .stub(strategy['cnsResolver'], 'getResolverRecordsByKeyHash')
          .resolves({ key: testKey, value: testValue });
      });

      it('should sync keys', async () => {
        await strategy.processEvents(basicEvents);

        expect(cnsResolverAddressMock).to.have.been.calledOnceWith(testNode);
        expect(cnsResolverRecordsMock).to.have.been.calledOnceWith(
          '0x013370',
          '0x01',
          testNode,
        );
        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(
          new Resolution({
            node: testNode,
            blockchain: testBlockchain,
            networkId: testNetworkId,
            resolution: {
              [testKey]: testValue,
            },
          }),
        );
      });

      it('should unset if keyhash is zero', async () => {
        basicEvents[0].args = {
          updateId: '0x00',
        };
        await strategy.processEvents(basicEvents);

        expect(cnsResolverAddressMock).to.have.been.calledOnceWith(testNode);
        expect(cnsResolverRecordsMock).to.not.have.been.called;

        const expected = new Resolution({
          node: testNode,
          blockchain: testBlockchain,
          networkId: testNetworkId,
        });
        expected.resolution = undefined;

        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(expected);
      });
      it('should unset on error in cns resolver', async () => {
        cnsResolverRecordsMock.rejects(new Error(ExecutionRevertedError));

        await strategy.processEvents(basicEvents);

        expect(cnsResolverAddressMock).to.have.been.calledOnceWith(testNode);
        expect(cnsResolverRecordsMock).to.have.been.calledOnceWith(
          '0x013370',
          '0x01',
          testNode,
        );

        const expected = new Resolution({
          node: testNode,
          blockchain: testBlockchain,
          networkId: testNetworkId,
        });
        expected.resolution = undefined;

        expect(
          workerRepositoryMock.saveResolutions,
        ).to.have.been.calledOnceWith(expected);
      });
      it('should not sync if args are undefined', async () => {
        basicEvents[0].args = undefined;
        await strategy.processEvents(basicEvents);

        expect(cnsResolverAddressMock).to.not.have.been.called;
        expect(cnsResolverRecordsMock).to.not.have.been.called;
        expect(workerRepositoryMock.saveResolutions).to.not.have.been.called;
      });
    });

    describe('SetReverse', () => {
      let basicEvents: WorkerEvent[];

      beforeEach(() => {
        basicEvents = [
          {
            node: testNode,
            type: 'SetReverse',
            args: {
              addr: testOwner,
            },
          },
        ];
      });

      it('should set reverse', async () => {
        await strategy.processEvents(basicEvents);

        expect(
          workerRepositoryMock.saveReverseResolutions,
        ).to.have.been.calledOnceWith({
          node: testNode,
          reverseAddress: testOwner,
          blockchain: testBlockchain,
          networkId: testNetworkId,
        });
      });

      it('should not save if args are missing', async () => {
        basicEvents[0].args = undefined;

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.saveReverseResolutions).to.not.have.been
          .called;
      });
    });

    describe('RemoveReverse', () => {
      let basicEvents: WorkerEvent[];

      beforeEach(() => {
        basicEvents = [
          {
            node: testNode,
            type: 'RemoveReverse',
            args: {
              addr: testOwner,
            },
          },
        ];
      });

      it('should set reverse', async () => {
        await strategy.processEvents(basicEvents);

        expect(
          workerRepositoryMock.removeReverseResolutions,
        ).to.have.been.calledOnceWith({
          reverseAddress: testOwner,
          blockchain: testBlockchain,
          networkId: testNetworkId,
        });
      });

      it('should not save if args are missing', async () => {
        basicEvents[0].args = undefined;

        await strategy.processEvents(basicEvents);

        expect(workerRepositoryMock.removeReverseResolutions).to.not.have.been
          .called;
      });
    });
  });
});
