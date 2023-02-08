import { expect } from 'chai';
import * as sinon from 'sinon';
import { env } from '../env';
import { Blockchain } from '../types/common';
import { queryNewURIEvent } from './ethersUtils';
import {
  EthereumHelper,
  injectNetworkHelperConfig,
  resetNetworkHelperConfig,
} from './testing/EthereumTestsHelper';
import {
  getNSConfig,
  LayerTestFixture,
  NSConfig,
} from './testing/LayerFixturesHelper';
import * as PromiseUtils from './promiseUtils';

describe('Ethers Util functions', () => {
  const L1Fixture: LayerTestFixture = new LayerTestFixture();
  const L2Fixture: LayerTestFixture = new LayerTestFixture();

  let uns: NSConfig;
  let withPromiseTimeoutSpy: sinon.SinonSpy;

  beforeEach(() => {
    withPromiseTimeoutSpy = sinon.spy(PromiseUtils, 'withPromiseTimeout');
  });

  afterEach(() => {
    sinon.restore();
  });

  before(async () => {
    await EthereumHelper.stopNetwork();

    await L1Fixture.setup(Blockchain.ETH, env.APPLICATION.ETHEREUM, {});
    injectNetworkHelperConfig({
      url: 'http://localhost:7546',
      chainId: 1337,
      dbPath: './.sandboxl2',
    });
    await L2Fixture.setup(Blockchain.MATIC, env.APPLICATION.POLYGON, {
      network: {
        url: 'http://localhost:7546',
        chainId: 1337,
        dbPath: './.sandboxl2',
      },
    });
    resetNetworkHelperConfig();
  });

  after(async () => {
    await L1Fixture.networkHelper.stopNetwork();
    await L2Fixture.networkHelper.stopNetwork();
  });

  describe('queryNewURIEvent', () => {
    beforeEach(() => {
      uns = getNSConfig('wallet');
    });

    it('should return a newURI event from l1', async () => {
      const owner = L1Fixture.networkHelper.owner().address;
      await L1Fixture.prepareService(owner, uns);

      const token = uns.node.toHexString();
      const newUri = await queryNewURIEvent(token);
      expect(newUri).to.not.undefined;
      expect(newUri!.args).not.undefined;
      const { uri, tokenId } = newUri!.args!;
      expect(uri).to.equal(uns.name);
      expect(tokenId).to.deep.equal(uns.node);

      expect(withPromiseTimeoutSpy).to.have.been.calledOnce;
      expect(withPromiseTimeoutSpy.getCall(0).args[1]).to.eq(1500);
    });

    it('should return a newURI event from l2', async () => {
      const owner = L2Fixture.networkHelper.owner().address;
      await L2Fixture.prepareService(owner, uns);

      const token = uns.node.toHexString();
      const newUri = await queryNewURIEvent(token);
      expect(newUri).to.be.not.undefined;
      expect(newUri!.args).to.be.not.undefined;
      const { uri, tokenId } = newUri!.args!;
      expect(uri).to.equal(uns.name);
      expect(tokenId).to.deep.equal(uns.node);
      expect(withPromiseTimeoutSpy).to.have.been.called;

      expect(withPromiseTimeoutSpy).to.have.been.calledOnce;
      expect(withPromiseTimeoutSpy.getCall(0).args[1]).to.eq(1500);
    });

    it('should return undefined for non existing newURI', async () => {
      const notExist = await queryNewURIEvent(
        '0xba426519be7884029d9579bf125b1b335000ad0e9f19eaa3454ee175e9276d9a',
      );
      expect(notExist).to.be.undefined;

      expect(withPromiseTimeoutSpy).to.have.been.calledOnce;
      expect(withPromiseTimeoutSpy.getCall(0).args[1]).to.eq(1500);
    });
  });
});
