import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../../../env';
import { Domain, WorkerStatus } from '../../../../models';
import { EthereumHelper } from '../../../../utils/testing/EthereumTestsHelper';
import { CnsResolver } from '../../CnsResolver';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../../../utils/namehash';
import { ETHContracts } from '../../../../contracts';
import supportedKeysJson from 'uns/resolver-keys.json';
import * as ethersUtils from '../../../../utils/ethersUtils';
import { DomainTestHelper } from '../../../../utils/testing/DomainTestHelper';
import { Blockchain } from '../../../../types/common';
import { getWorkerRepository, Resolution } from '../../../framework';
import { describeIntegrationTest } from '../../../../utils/testing/IntegrationTestDescribe';

describeIntegrationTest('CnsResolver', () => {
  let service: CnsResolver;
  let registry: Contract;
  let resolver: Contract;
  let mintingManager: Contract;
  let legacyResolver: Contract;

  let testDomainName: string;
  let testTokenId: BigNumber;
  let testDomainLabel: string;
  let testDomainNode: string;
  const cnsNamehash: string = eip137Namehash('crypto');
  const sinonSandbox = sinon.createSandbox();
  const PredefinedRecordKeys = Object.keys(supportedKeysJson.keys);

  const RecordKeys = [
    'crypto.BCH.address',
    'crypto.BTC.address',
    'crypto.XZC.address',
    'crypto.ETH.address',
    'crypto.LTC.address',
    'crypto.XEM.address',
    'crypto.XRP.address',
    'crypto.BURST.address',
    'crypto.DASH.address',
    'crypto.ATOM.address',
    'crypto.ONG.address',
  ];

  const ResolverValues = [
    'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
    'bc1qh3wv4mwgzethhyz76pkct4jwvat3ylrq327am4',
    '',
    '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
    'ltc1qgjhx3jjalu6ypae06nmeclzcwmu8algvn662xm',
    'NA4KUBIZKDCI57A4D62HZQWYSJLU4IJO5SZZTBK4',
    'rhtv69R8EoMuCSJt1fdfwpBgq3dY6C35XX',
    '',
    'XwkTBYxRB3TFYSHYZ9CfpDM4oFBccRwdAH',
    '',
    '',
  ];

  const ExpectedResolverRecords = {
    'crypto.BCH.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
    'crypto.BTC.address': 'bc1qh3wv4mwgzethhyz76pkct4jwvat3ylrq327am4',
    'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
    'crypto.LTC.address': 'ltc1qgjhx3jjalu6ypae06nmeclzcwmu8algvn662xm',
    'crypto.XEM.address': 'NA4KUBIZKDCI57A4D62HZQWYSJLU4IJO5SZZTBK4',
    'crypto.XRP.address': 'rhtv69R8EoMuCSJt1fdfwpBgq3dY6C35XX',
    'crypto.DASH.address': 'XwkTBYxRB3TFYSHYZ9CfpDM4oFBccRwdAH',
  };

  const AddressZero = '0x0000000000000000000000000000000000000000';

  before(async () => {
    await EthereumHelper.startNetwork();
    await EthereumHelper.resetNetwork();

    registry = ETHContracts.CNSRegistry.getContract().connect(
      EthereumHelper.owner(),
    );
    resolver = ETHContracts.Resolver.getContract().connect(
      EthereumHelper.owner(),
    );
    mintingManager = ETHContracts.MintingManager.getContract().connect(
      EthereumHelper.minter(),
    );
  });

  beforeEach(async () => {
    sinon
      .stub(
        env.APPLICATION.ETHEREUM,
        'CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK',
      )
      .value(await ethersUtils.getLatestNetworkBlock());

    testDomainLabel = randomBytes(16).toString('hex');
    testDomainName = `${testDomainLabel}.crypto`;
    testDomainNode = eip137Namehash(testDomainName);
    testTokenId = BigNumber.from(testDomainNode);

    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      await ethersUtils.getLatestNetworkBlock(),
    );
    await mintingManager.functions
      .issueWithRecords(
        EthereumHelper.owner().address,
        [testDomainLabel, 'crypto'],
        [],
        [],
        true,
      )
      .then((receipt) => receipt.wait());
    await EthereumHelper.mineBlocksForConfirmation();

    service = new CnsResolver(
      ETHContracts,
      getWorkerRepository(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID),
    );
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('basic domain records', () => {
    it('should fetch resolver', async () => {
      const { domain, resolution } = await DomainTestHelper.createTestDomain({
        name: testDomainName,
        node: testDomainNode,
      });

      await service.fetchResolver(
        new Resolution({
          node: domain.node,
          blockchain: resolution.blockchain,
          networkId: resolution.networkId,
          ownerAddress: resolution.ownerAddress,
          resolver: resolution.resolver,
          registry: resolution.registry,
          resolution: resolution.resolution,
        }),
      );

      const updatedDomain = await Domain.findByNode(domain.node);
      const updatedResolution = updatedDomain?.getResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );

      expect(updatedResolution?.resolver).to.equal(
        resolver.address.toLowerCase(),
      );
    });

    it('should fetch resolver with domain records', async () => {
      await resolver.functions
        .reconfigure(
          ['crypto.BTC.address', 'crypto.ETH.address'],
          [
            'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
            '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
          ],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      const { domain, resolution } = await DomainTestHelper.createTestDomain({
        name: testDomainName,
        node: testDomainNode,
      });

      await service.fetchResolver(
        new Resolution({
          node: domain.node,
          blockchain: resolution.blockchain,
          networkId: resolution.networkId,
          ownerAddress: resolution.ownerAddress,
          resolver: resolution.resolver,
          registry: resolution.registry,
          resolution: resolution.resolution,
        }),
      );

      const updatedDomain = await Domain.findByNode(domain.node);
      const updatedResolution = updatedDomain?.getResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );

      expect(updatedResolution?.resolution).to.deep.equal({
        'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
        'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
      });
    });

    it('resets records when resolver is unset', async () => {
      await registry.functions
        .resolveTo(AddressZero, testTokenId)
        .then((receipt) => receipt.wait());
      const { domain, resolution } = await DomainTestHelper.createTestDomain({
        name: testDomainName,
        node: testDomainNode,
      });
      resolution.resolver = resolver.address.toLowerCase();
      (resolution.resolution = { hello: 'world' }),
        await domain.update({
          resolutions: [resolution],
        });

      await service.fetchResolver(
        new Resolution({
          node: domain.node,
          blockchain: resolution.blockchain,
          networkId: resolution.networkId,
          ownerAddress: resolution.ownerAddress,
          resolver: resolution.resolver,
          registry: resolution.registry,
          resolution: resolution.resolution,
        }),
      );

      const updatedDomain = await Domain.findByNode(domain.node);

      expect(updatedDomain?.resolutions[0].resolution).to.be.empty;
    });

    it('should get all predefined resolver records', async () => {
      await resolver.functions
        .reconfigure(RecordKeys, ResolverValues, testTokenId)
        .then((receipt) => receipt.wait());
      const resolverRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
      );
      expect(resolverRecords).to.deep.equal(ExpectedResolverRecords);
    });

    it('should get all predefined resolver records with pagination', async () => {
      await resolver.functions
        .reconfigure(RecordKeys, ResolverValues, testTokenId)
        .then((receipt) => receipt.wait());
      const ethereumCallSpy = sinonSandbox.spy(
        service,
        '_getManyDomainRecords',
      );
      const resolverRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
        1,
      );
      RecordKeys.forEach((key, callNumber) => {
        expect(ethereumCallSpy.getCall(callNumber)).to.be.calledWith(
          resolver.address,
          [key],
          testTokenId,
        );
      });
      expect(resolverRecords).to.deep.equal(ExpectedResolverRecords);
      ethereumCallSpy.restore();
    });
  });
  describe('custom domain records', () => {
    it('should get all custom records', async () => {
      await resolver.functions
        .reconfigure(['custom-key'], ['custom-value'], testTokenId)
        .then((receipt) => receipt.wait());

      const customRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
      );
      expect(customRecords).to.deep.equal({ 'custom-key': 'custom-value' });
    });

    it('should filter keys duplicates from NewKey events', async () => {
      await resolver.functions
        .reconfigure(
          ['custom-key', 'custom-key', 'custom-key', 'custom-key'],
          [
            'custom-value',
            'custom-value-1',
            'custom-value-2',
            'this-is-the-value',
          ],
          testTokenId,
        )
        .then((receipt) => receipt.wait());

      const customRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
      );
      expect(customRecords).to.deep.equal({
        'custom-key': 'this-is-the-value',
      });
    });

    it.skip('should fallback to predefined keys set if Resolver does not have NewKey events', async () => {
      await registry.functions
        .resolveTo(legacyResolver.address, testTokenId)
        .then((receipt) => receipt.wait());
      await legacyResolver.functions
        .setMany(
          ['custom-key', 'crypto.BTC.address'],
          ['custom-value', 'bc1qj5jdpvg0u73qxgvwulc2nkcrjvwvhvm0fnyy85'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());

      const records = await service._getAllDomainRecords(
        legacyResolver.address,
        testTokenId,
      );
      expect(records).to.deep.equal({
        'crypto.BTC.address': 'bc1qj5jdpvg0u73qxgvwulc2nkcrjvwvhvm0fnyy85',
      });
    });

    it('should search new keys starting from last ResetRecords event', async () => {
      await resolver.functions
        .setMany(
          ['crypto.BTC.address', 'crypto.ETH.address'],
          [
            'bc1qj5jdpvg0u73qxgvwulc2nkcrjvwvhvm0fnyy85',
            '0xBDF21E8383Acb9d1364A6ed940dfCbDF42A86f75',
          ],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      await resolver.functions
        .reconfigure(['custom-key'], ['custom-value'], testTokenId)
        .then((receipt) => receipt.wait());
      const resetRecordsBlockNumber = await ethersUtils.getLatestNetworkBlock();
      const ethereumCallSpy = sinonSandbox.spy(service, '_getResolverEvents');
      const domainRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
      );
      expect(ethereumCallSpy.firstCall).to.be.calledWith(
        sinonSandbox.match.any,
        {
          address: resolver.address,
          topics: [
            '0x185c30856dadb58bf097c1f665a52ada7029752dbcad008ea3fefc73bee8c9fe', // signature of ResetRecords event
            testDomainNode,
          ],
        },
        env.APPLICATION.ETHEREUM.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK,
      );
      expect(ethereumCallSpy.secondCall).to.be.calledWith(
        sinonSandbox.match.any,
        {
          address: resolver.address,
          topics: [
            '0x7ae4f661958fbecc2f77be6b0eb280d2a6f604b29e1e7221c82b9da0c4af7f86', // signature of NewKey event
            testDomainNode,
          ],
        },
        resetRecordsBlockNumber,
      );
      expect(domainRecords).to.deep.equal({ 'custom-key': 'custom-value' });
    });
    it.skip('should fallback to predefined keys and start block if use legacy resolver', async () => {
      await registry.functions
        .resolveTo(legacyResolver.address, testTokenId)
        .then((receipt) => receipt.wait());
      const ethereumCallSpy = sinonSandbox.spy(
        service,
        '_getManyDomainRecords',
      );
      await service._getAllDomainRecords(
        legacyResolver.address,
        testTokenId,
        200,
      );
      expect(ethereumCallSpy).to.be.calledWith(
        legacyResolver.address,
        PredefinedRecordKeys,
        testDomainNode,
      );
    });
  });

  describe('.normalizeResolver', () => {
    it('should normalize the resolver address', () => {
      const resolver = '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842';
      const expected = '0xb66dce2da6afaaa98f2013446dbcb0f4b0ab2842';
      expect(CnsResolver.normalizeResolver(resolver)).to.be.equal(expected);
    });

    it('should return null for zero address', () => {
      const resolver = Domain.NullAddress;
      expect(CnsResolver.normalizeResolver(resolver)).to.be.null;
    });

    it('should return null for undefined resolver address', () => {
      const resolver = undefined;
      expect(CnsResolver.normalizeResolver(resolver)).to.be.null;
    });
  });
});
