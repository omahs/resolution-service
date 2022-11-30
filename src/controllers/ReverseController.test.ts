import supertest from 'supertest';
import { expect } from 'chai';
import { api } from '../api';
import { env } from '../env';
import { ApiKey, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { eip137Namehash } from '../utils/namehash';

describe('ReverseController', () => {
  const ReverseAddress1 = '0x8aad44321a86b170879d7a244c1e8d360c99dda8';
  const ReverseAddress2 = '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910';
  const Registry = '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe';
  const Resolver = '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe';
  let testApiKey: ApiKey;

  beforeEach(async () => {
    const { domain: domain1 } = await DomainTestHelper.createTestDomain({
      name: 'brad.crypto',
      node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      ownerAddress: ReverseAddress1,
      blockchain: Blockchain.ETH,
      networkId: 1337,
      registry: Registry,
      resolution: {
        'crypto.ETH.address': ReverseAddress1,
      },
      resolver: Resolver,
    });

    const { domain: domain2 } = await DomainTestHelper.createTestDomain({
      name: 'test.crypto',
      node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      ownerAddress: ReverseAddress2,
      blockchain: Blockchain.MATIC,
      networkId: 1337,
      registry: Registry,
      resolution: {
        'crypto.ETH.address': ReverseAddress2,
      },
      resolver: Resolver,
    });

    const resolution1 = domain1.getResolution(Blockchain.MATIC, 1337);
    resolution1.ownerAddress = '0x0000000000000000000000000000000000000000';
    resolution1.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution1.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution1.resolution = {};
    domain1.setResolution(resolution1);

    const resolution2 = domain2.getResolution(Blockchain.MATIC, 1337);
    resolution2.ownerAddress = '0x0000000000000000000000000000000000000000';
    resolution2.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution2.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution2.resolution = {};
    domain1.setResolution(resolution2);

    const reverse1 = new DomainsReverseResolution({
      blockchain: Blockchain.ETH,
      networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      reverseAddress: ReverseAddress1.toLowerCase(),
    });
    domain1.setReverseResolution(reverse1);
    await domain1.save();

    const reverse2 = new DomainsReverseResolution({
      blockchain: Blockchain.ETH,
      networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      reverseAddress: ReverseAddress2.toLowerCase(),
    });
    domain2.setReverseResolution(reverse2);
    await domain2.save();

    testApiKey = await ApiKey.createApiKey('testing key');
  });

  describe('GET /reverse/:address', () => {
    it('should require api key', async () => {
      const res = await supertest(api)
        .get(`/reverse/${ReverseAddress1}`)
        .send();

      expect(res.status).eq(403);
    });

    it('should return domain for reverse resolution', async () => {
      const res = await supertest(api)
        .get(`/reverse/${ReverseAddress1}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: ReverseAddress1,
          resolver: Resolver,
          registry: Registry,
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': ReverseAddress1,
        },
      });
    });

    it('should return empty response for non existing reverse resolution', async () => {
      const emptyAddress = '0x1234567890123456789012345678901234567890';
      const res = await supertest(api)
        .get(`/reverse/${emptyAddress}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: '',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
    });

    it('should return empty response for nonsupported tld', async () => {
      const reverseAddressUnsopported =
        '0x8aaD44321A86b170879d7A244c1e8d360c99DdA1';
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'brad.coin',
        node: eip137Namehash('brad.coin'),
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA1',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: Registry,
        resolution: {
          'crypto.ETH.address': ReverseAddress1,
        },
        resolver: Resolver,
      });

      const resolution = domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x0000000000000000000000000000000000000000';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {};
      domain.setResolution(resolution);

      const reverse = new DomainsReverseResolution({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        reverseAddress: reverseAddressUnsopported.toLowerCase(),
      });
      domain.setReverseResolution(reverse);
      await domain.save();

      const res = await supertest(api)
        .get(`/reverse/${reverseAddressUnsopported}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: '',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
    });
  });

  describe('POST /reverse/query', () => {
    it('should require api key', async () => {
      const res = await supertest(api).post(`/reverse/query`).send();
      expect(res.status).eq(403);
    });

    it('should require valid json body', async () => {
      const res = await supertest(api)
        .post(`/reverse/query`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send({
          invalid: '',
        });
      expect(res.status).eq(400);
    });

    it('should return empty data if no reverse resolution found', async () => {
      const res = await supertest(api)
        .post(`/reverse/query`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send({
          addresses: ['0x0000000000000000000000000000000000000000'],
        });
      expect(res.status).eq(200);
      expect(res.body).to.containSubset({
        data: [],
      });
    });

    it('should return partially found reverse resolution ', async () => {
      const res = await supertest(api)
        .post(`/reverse/query`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send({
          addresses: [
            ReverseAddress1,
            '0x0000000000000000000000000000000000000000',
          ],
        });
      expect(res.status).eq(200);
      expect(res.body).deep.equal({
        data: [
          {
            meta: {
              domain: 'brad.crypto',
              owner: ReverseAddress1,
              reverse: true,
            },
          },
        ],
      });
    });

    it('should return all found reverse resolution', async () => {
      const res = await supertest(api)
        .post(`/reverse/query`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send({
          addresses: [ReverseAddress1, ReverseAddress2],
        });
      expect(res.status).eq(200);
      expect(res.body).deep.equal({
        data: [
          {
            meta: {
              domain: 'brad.crypto',
              owner: ReverseAddress1,
              reverse: true,
            },
          },
          {
            meta: {
              domain: 'test.crypto',
              owner: ReverseAddress2,
              reverse: true,
            },
          },
        ],
      });
    });
  });
});
