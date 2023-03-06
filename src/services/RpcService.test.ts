import { expect } from 'chai';
import sinon from 'sinon';
import * as nodeFetch from 'node-fetch';

import { env } from '../env';
import { RpcService } from './RpcService';
import { Blockchain } from '../types/common';

describe('Rpc service', () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(async () => {
    fetchStub = sinon.stub(nodeFetch, 'default');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should not allow to instantiate RpcService with negative timeout', () => {
      expect(() => new RpcService(-1000)).to.throw('Invalid timeout');
    });

    it('should not allow to instantiate RpcService with timeout greater than 5 seconds', () => {
      expect(() => new RpcService(5500)).to.throw('Invalid timeout');
    });
  });

  describe('post', () => {
    let rpcInstance: RpcService;

    beforeEach(() => {
      rpcInstance = new RpcService(1000);
    });

    it('should send request to the correct eth network url', async () => {
      fetchStub.resolves({
        json: () => Promise.resolve({ response: 'some value' }),
      });

      const res = await rpcInstance.post(Blockchain.ETH, { key: 'some value' });

      expect(fetchStub).to.have.been.calledOnceWithExactly(
        env.APPLICATION.ETHEREUM.JSON_RPC_API_URL,
        {
          method: 'post',
          body: JSON.stringify({ key: 'some value' }),
          headers: { 'Content-Type': 'application/json' },
          timeout: 1000,
        },
      );

      expect(res).to.eql({ response: 'some value' });
    });

    it('should send request to the correct matic network url', async () => {
      fetchStub.resolves({
        json: () => Promise.resolve({ response: 'some value' }),
      });

      const res = await rpcInstance.post(Blockchain.MATIC, {
        key: 'some value',
      });

      expect(fetchStub).to.have.been.calledOnceWithExactly(
        env.APPLICATION.POLYGON.JSON_RPC_API_URL,
        {
          method: 'post',
          body: JSON.stringify({ key: 'some value' }),
          headers: { 'Content-Type': 'application/json' },
          timeout: 1000,
        },
      );

      expect(res).to.eql({ response: 'some value' });
    });

    it('should throw an error if blockchain argument is not supported', async () => {
      await expect(
        rpcInstance.post(Blockchain.ZIL, { key: 'some value' }),
      ).to.eventually.be.rejectedWith(
        `Unsupported blockchain ${Blockchain.ZIL}`,
      );
    });

    it('should handle node-fetch FetchError error', async () => {
      fetchStub.rejects(new nodeFetch.FetchError('some error', 'timeout'));

      await expect(
        rpcInstance.post(Blockchain.ETH, { key: 'some value' }),
      ).to.eventually.be.rejectedWith('timeout');
    });

    it('should handle other error', async () => {
      fetchStub.rejects(new Error('some error'));

      await expect(
        rpcInstance.post(Blockchain.ETH, { key: 'some value' }),
      ).to.eventually.be.rejectedWith('some error');
    });
  });
});
