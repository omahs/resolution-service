import supertest from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';

import { api } from '../api';
import { ApiKey } from '../models';
import { Blockchain } from '../types/common';
import { RpcService } from '../services/RpcService';
import * as heap from '../utils/heap';
import { HeapEvents } from '../types/heap';

const SUPERTEST_TESTING_IP = '::ffff:127.0.0.1';

describe('RpcProxyController', () => {
  let postStub: sinon.SinonStub;
  let testApiKey: ApiKey;
  let trackStub: sinon.SinonStub;

  beforeEach(async () => {
    postStub = sinon.stub(RpcService.prototype, 'post');
    testApiKey = await ApiKey.createApiKey('testing key');
    trackStub = sinon.stub(heap, 'track').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  function proxyTestSuit(options: { path: string; blockchain: Blockchain }) {
    const { path, blockchain } = options;

    it('should proxy request to provided URL', async () => {
      postStub.resolves({
        response: 'value',
      });
      const res = await supertest(api)
        .post(path)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .set('X-Lib-Agent', 'some value')
        .send({
          key: 'value',
        });

      expect(postStub).to.have.been.calledOnceWithExactly(blockchain, {
        key: 'value',
      });

      expect(trackStub).to.be.calledWith({
        identity: SUPERTEST_TESTING_IP,
        eventName: HeapEvents.POST_RPC_PROXY,
        properties: {
          apiKey: testApiKey.apiKey,
          'x-lib-agent': 'some value',
          uri: path,
          responseCode: 200,
        },
      });
      expect(res.body).to.eql({ response: 'value' });
    });

    it('should forward error from RpcService', async () => {
      postStub.rejects(new Error('some error'));

      const res = await supertest(api)
        .post(path)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send({
          key: 'value',
        });

      expect(trackStub).to.be.calledWith({
        identity: SUPERTEST_TESTING_IP,
        eventName: HeapEvents.POST_RPC_PROXY,
        properties: {
          apiKey: testApiKey.apiKey,
          uri: path,
          responseCode: 400,
        },
      });

      expect(postStub).to.have.been.calledOnceWithExactly(blockchain, {
        key: 'value',
      });

      expect(res.body.code).to.equal('RpcProviderError');
      expect(res.body.message).to.equal('some error');
    });
  }

  describe('POST /chains/eth/rpc', () => {
    proxyTestSuit({
      path: '/chains/eth/rpc',
      blockchain: Blockchain.ETH,
    });
  });

  describe('POST /chains/matic/rpc', () => {
    proxyTestSuit({
      path: '/chains/matic/rpc',
      blockchain: Blockchain.MATIC,
    });
  });
});
