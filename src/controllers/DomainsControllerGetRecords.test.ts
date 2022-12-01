import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { ApiKey, Domain } from '../models';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { describe } from 'mocha';
import { nockConfigure } from '../mochaHooks';
import { HeapEvents } from '../types/heap';
import * as heap from '../utils/heap';
import sinon from 'sinon';

describe('DomainsController', () => {
  let testApiKey: ApiKey;

  beforeEach(async () => {
    testApiKey = await ApiKey.createApiKey('testing key');
    nockConfigure();
  });

  describe('GET /records', () => {
    it('should return error for unauthorized query', async () => {
      const res = await supertest(api).get('/records?domains[]=one.x').send();
      expect(res.status).eq(403);
      expect(res.body).containSubset({
        message: 'Please provide a valid API key.',
      });
    });

    it('should NOT call the tracking event on an unsuccessful response', async () => {
      const trackStub = sinon.stub(heap, 'track');
      const res = await supertest(api).get('/records?domains[]=one.x').send();
      expect(res.status).eq(403);
      expect(trackStub).to.not.be.called;
      trackStub.restore();
    });

    it('should call the tracking event on a successful response', async () => {
      const SUPERTEST_TESTING_IP = '::ffff:127.0.0.1';
      const trackStub = sinon.stub(heap, 'track');
      await DomainTestHelper.createTestDomainL2(
        {
          name: 'testb.crypto',
          node: '0xe952ce3758282cce878760001be22370f4842793139518e119ae04ae24004206',
        },
        {
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          ownerAddress: Domain.NullAddress,
        },
        {
          registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          resolution: {
            'crypto.ETH.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            'social.picture.value': 'yo',
          },
        },
      );
      const res = await supertest(api)
        .get(
          '/records?domains[]=testb.crypto&domains[]=test2.crypto&key=social.picture.value',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(trackStub).to.be.calledWith({
        identity: SUPERTEST_TESTING_IP,
        eventName: HeapEvents.GET_DOMAIN_RECORDS,
        properties: {
          apiKey: testApiKey.apiKey,
          uri: '/records?domains[]=testb.crypto&domains[]=test2.crypto&key=social.picture.value',
        },
      });
      trackStub.restore();
    });

    it('should return empty response', async () => {
      const res = await supertest(api)
        .get('/records?domains[]=404.x')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).containSubset({
        data: [],
      });
      expect(res.status).eq(200);
    });

    it('should return records for multiple domains', async () => {
      const { domain: testDomain1 } = await DomainTestHelper.createTestDomain({
        name: 'test1.crypto',
        node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.ETH.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        },
      });
      const { domain: testDomain2 } = await DomainTestHelper.createTestDomain({
        name: 'test2.crypto',
        node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.ETH.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        },
      });

      const res = await supertest(api)
        .get('/records?domains[]=test1.crypto&domains[]=test2.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            domain: testDomain1.name,
            records: testDomain1.resolutions[0].resolution,
          },
          {
            domain: testDomain2.name,
            records: testDomain2.resolutions[0].resolution,
          },
        ],
      });
      expect(res.status).eq(200);
    });

    it('returns a particular record, and a blank record for non existent domain', async () => {
      const { domain: testDomain1 } = await DomainTestHelper.createTestDomainL2(
        {
          name: 'testb.crypto',
          node: '0xe952ce3758282cce878760001be22370f4842793139518e119ae04ae24004206',
        },
        {
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          ownerAddress: Domain.NullAddress,
        },
        {
          registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          resolution: {
            'crypto.ETH.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            'social.picture.value': 'yo',
          },
        },
      );

      const res = await supertest(api)
        .get(
          '/records?domains[]=testb.crypto&domains[]=test2.crypto&key=social.picture.value',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            domain: testDomain1.name,
            records: { 'social.picture.value': 'yo' },
          },
          {
            domain: 'test2.crypto', // Domain does not exist
            records: {},
          },
        ],
      });
      expect(res.status).eq(200);
    });

    it('throws error if the requested key is not supported', async () => {
      const res = await supertest(api)
        .get('/records?domains[]=testb.crypto&key=wrong')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body).to.containSubset({
        code: 'BadRequestError',
        message: "Invalid queries, check 'errors' property for more info.",
        errors: [
          {
            constraints: {
              'validate key with containsSupportedKey':
                'Unsupported Unstoppable Domains key',
            },
          },
        ],
      });
    });
  });
});
