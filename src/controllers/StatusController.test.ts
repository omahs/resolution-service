import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { WorkerStatus } from '../models';
import { Blockchain } from '../types/common';

describe('StatusController', () => {
  describe('HEAD /', () => {
    it('should return empty body', async () => {
      const response = await supertest(api)
        .head(`/`)
        .send()
        .then((r) => r);

      const emptyBody = {};
      expect(response.body).to.be.deep.equal(emptyBody);
    });
  });

  it('should redirect user', async () => {
    const res = await supertest(api)
      .get('/')
      .send()
      .expect(302)
      .expect('Location', '/api-docs');
  });

  describe('/status', () => {
    const testCases = [
      {
        name: 'should return appropriate status',
        expectedStatusBody: {
          blockchain: {
            ETH: {
              latestMirroredBlock: 901,
              lastUpdated: new Date().getTime(),
              networkId: 1337,
              isUpToDate: true,
            },
            MATIC: {
              latestMirroredBlock: 12145,
              lastUpdated: new Date().getTime(),
              networkId: 1337,
              isUpToDate: true,
            },
            ZIL: {
              latestMirroredBlock: 171102,
              lastUpdated: new Date().getTime(),
              networkId: 333,
              isUpToDate: true,
            },
          },
        },
      },
      {
        name: 'should return false for outdated statuses',
        expectedStatusBody: {
          blockchain: {
            ETH: {
              latestMirroredBlock: 901,
              lastUpdated: new Date().getTime() - 3600000,
              networkId: 1337,
              isUpToDate: false,
            },
            MATIC: {
              latestMirroredBlock: 12145,
              lastUpdated: new Date().getTime() - 3600000,
              networkId: 1337,
              isUpToDate: false,
            },
            ZIL: {
              latestMirroredBlock: 171102,
              lastUpdated: new Date().getTime() - 3600000,
              networkId: 333,
              isUpToDate: false,
            },
          },
        },
      },
    ];

    testCases.forEach((test) => {
      it(test.name, async () => {
        for (const key in test.expectedStatusBody.blockchain) {
          const status = test.expectedStatusBody.blockchain[key as Blockchain];
          await new WorkerStatus({
            updatedAt: new Date(status.lastUpdated),
            location: key as Blockchain,
            lastMirroredBlockNumber: status.latestMirroredBlock,
          }).save();
        }

        const res = await supertest(api).get('/status').send();

        expect(res.body).containSubset(test.expectedStatusBody);
        expect(res.status).eq(200);
      });
    });
  });

  it('should return ok for /liveness_check and /readiness_check endpoints', async () => {
    const expectedResponse = { status: 'ok' };
    const livenessCheck = await supertest(api).get('/liveness_check').send();
    const readinessCheck = await supertest(api).get('/readiness_check').send();
    expect(livenessCheck.body).containSubset(expectedResponse);
    expect(readinessCheck.body).containSubset(expectedResponse);
  });

  it('should return list of supported tlds for /supported_tlds endpoint', async () => {
    const expectedResponse = {
      tlds: [
        'crypto',
        'wallet',
        'blockchain',
        'bitcoin',
        'x',
        '888',
        'nft',
        'dao',
        'zil',
        'klever',
        'hi',
        'kresus',
        'polygon',
      ],
    };
    const response = await supertest(api).get('/supported_tlds').send();
    // check the response data schema
    expect(response.body).containSubset(expectedResponse);
    // check if it's missing any expected tlds
    expect(response.body.tlds).to.have.members(expectedResponse.tlds);
  });
});
