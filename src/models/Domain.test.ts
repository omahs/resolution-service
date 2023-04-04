import { expect } from 'chai';
import { env } from '../env';
import { Blockchain } from '../types/common';
import {
  EthereumHelper,
  injectNetworkHelperConfig,
  resetNetworkHelperConfig,
} from '../utils/testing/EthereumTestsHelper';
import {
  getNSConfig,
  LayerTestFixture,
} from '../utils/testing/LayerFixturesHelper';
import Domain from './Domain';
import nock from 'nock';
import { nockConfigure } from '../mochaHooks';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import DomainsReverseResolution from './DomainsReverseResolution';
import { eip137Namehash } from '../utils/namehash';

describe('Domain', () => {
  describe('constructor()', () => {
    it('should successfully create entity', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      const domainTwo = Domain.create({
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
      });
      const domainThree = Domain.create({
        name: 'test1.x',
        node: '0xd40233894d702a593754963512f52ff891dbe215dd06195717dace1212a03fa7',
      });
      await domain.save();
      await domainTwo.save();
      await domainThree.save();
      expect(domain.id).to.be.a('number');
      expect(domainTwo.id).to.be.a('number');
      expect(domainThree.id).to.be.a('number');
    });

    it('should fail nameMatchesNode validation', async () => {
      const domain = Domain.create({
        name: 'test1.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      await expect(domain.save()).to.be.rejectedWith(
        '- property name has failed the following constraints: validate name with nameMatchesNode',
      );
    });
  });

  describe('.label', () => {
    it('should return label', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      expect(domain.label).to.equal('test');
    });
  });

  describe('.extension', () => {
    it('should return extension', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      expect(domain.extension).to.equal('crypto');
    });
  });

  describe('.findByNode', () => {
    it('should find by node', async () => {
      const domainMetaData = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      const domain = Domain.create(domainMetaData);
      await domain.save();

      const foundDomain = await Domain.findByNode(domainMetaData.node);

      expect(foundDomain).to.containSubset(domainMetaData);
    });

    it('should return undefined if node is undefined', async () => {
      const node = undefined;
      const foundDomain = await Domain.findByNode(node);
      expect(foundDomain).to.be.undefined;
    });
  });

  describe('.findOrCreateByName', () => {
    it('should create a domain', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      await Domain.findOrCreateByName(expectedDomain.name, Blockchain.ETH);
      const foundDomain = await Domain.findOne({ name: expectedDomain.name });

      expect(foundDomain).to.containSubset(expectedDomain);
    });

    it('should find a domain', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      const domain = Domain.create(expectedDomain);
      await domain.save();

      const foundDomain = await Domain.findOrCreateByName(
        expectedDomain.name,
        Blockchain.ETH,
      );

      expect(foundDomain).to.containSubset(expectedDomain);
    });
  });

  describe('.findOrBuildByNode', () => {
    it('should find an existed domain', async () => {
      const domainMetaData = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      await Domain.create(domainMetaData).save();
      const fromDb = await Domain.findOrBuildByNode(
        '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      );
      expect(fromDb).to.containSubset(domainMetaData);
    });

    it('should build new domain', async () => {
      const domainFromDb = await Domain.findOrBuildByNode(
        '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303107',
      );
      expect(domainFromDb).to.containSubset({
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303107',
      });
    });
  });

  describe('domain parent', () => {
    it('should fill domain parent', async () => {
      const domainMetaData = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      await Domain.create(domainMetaData).save();
      const fromDb = await Domain.findByNode(
        '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      );
      expect(fromDb?.parent?.name).to.equal('crypto');
      const subDomainMetaData = {
        name: 'sub.test.crypto',
        node: eip137Namehash('sub.test.crypto'),
      };
      await Domain.create(subDomainMetaData).save();
      const subdomainfromDb = await Domain.findByNode(
        eip137Namehash('sub.test.crypto'),
      );
      expect(subdomainfromDb?.parent?.name).to.equal('test.crypto');
    });
  });

  describe('reverse resolution', () => {
    const reverseAddress = '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8';
    let reverse: DomainsReverseResolution;

    beforeEach(async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const resolution = domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x0000000000000000000000000000000000000000';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {};
      domain.setResolution(resolution);

      reverse = new DomainsReverseResolution({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        reverseAddress: reverseAddress.toLowerCase(),
      });
      domain.setReverseResolution(reverse);
      await domain.save();
    });

    it('should return existing reverse resolution', async () => {
      const domain = await Domain.findByNode(
        '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      );
      const domainReverse = domain?.getReverseResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );
      expect(domainReverse).to.containSubset({
        reverseAddress: reverse.reverseAddress,
        blockchain: reverse.blockchain,
        networkId: reverse.networkId,
      });
    });

    it('should return undefined if reverse resolution does not exist', async () => {
      const domain = await Domain.findByNode(
        '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      );
      const domainReverse = domain?.getReverseResolution(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      expect(domainReverse).to.be.undefined;
    });

    it('should set new reverse resolution', async () => {
      const domain = await Domain.findByNode(
        '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      );
      const newReverse = new DomainsReverseResolution({
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        reverseAddress: reverseAddress.toLowerCase(),
      });
      domain?.setReverseResolution(newReverse);
      await domain?.save();

      const domainReverse = domain?.getReverseResolution(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      const oldReverse = domain?.getReverseResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );

      expect(domainReverse).to.containSubset({
        reverseAddress: newReverse.reverseAddress,
        blockchain: newReverse.blockchain,
        networkId: newReverse.networkId,
      });
      expect(oldReverse).to.containSubset({
        reverseAddress: reverse.reverseAddress,
        blockchain: reverse.blockchain,
        networkId: reverse.networkId,
      });
    });

    it('should reset existing reverse resolution', async () => {
      const newAddress = '0x0123401234012340123401234012340123401234';
      const domain = await Domain.findByNode(
        '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      );
      const newReverse = new DomainsReverseResolution({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        reverseAddress: newAddress,
      });
      domain?.setReverseResolution(newReverse);
      await domain?.save();

      const domainReverse = domain?.getReverseResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );

      expect(domainReverse).to.containSubset({
        reverseAddress: newReverse.reverseAddress,
        blockchain: newReverse.blockchain,
        networkId: newReverse.networkId,
      });
    });

    it('should remove reverse resolution', async () => {
      const domain = await Domain.findByNode(
        '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      );
      const removed = domain?.removeReverseResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );
      await domain?.save();

      const domainReverse = domain?.getReverseResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );

      expect(domainReverse).to.be.undefined;
      expect(removed).to.containSubset({
        reverseAddress: reverse.reverseAddress,
        blockchain: reverse.blockchain,
        networkId: reverse.networkId,
      });
    });
  });
});
