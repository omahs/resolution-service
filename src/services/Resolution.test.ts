import { expect } from 'chai';
import sinon from 'sinon';
import { env } from '../env';
import { Domain, DomainsResolution, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import { getDomainResolution, getReverseResolution } from './Resolution';
import { IsZilDomain } from '../utils/domain';
import { eip137Namehash, znsNamehash } from '../utils/namehash';

describe('Resolution service', () => {
  describe('isZilDomain', () => {
    it('should return true for .zil domains', () => {
      expect(IsZilDomain('test.zil')).to.be.true;
      expect(IsZilDomain('test.subdomain.zil')).to.be.true;
    });

    it('should return false for other domains', () => {
      expect(IsZilDomain('test.crypto')).to.be.false;
      expect(IsZilDomain('test.subdomain.crypto')).to.be.false;
      expect(IsZilDomain('test.blockchain')).to.be.false;
      expect(IsZilDomain('test.wallet')).to.be.false;
      expect(IsZilDomain('test.nonexistenttld')).to.be.false;
    });
  });

  describe('getDomainResolution', () => {
    const sinonSandbox = sinon.createSandbox();

    afterEach(() => {
      sinonSandbox.restore();
    });

    it('should return zil resolution for zil domain', () => {
      const domain = new Domain({
        name: 'test.zil',
        node: '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
      });
      const resolution = new DomainsResolution({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        resolution: { test: 'zil' },
      });
      const subdomain = new Domain({
        name: 'testing.test.zil',
        node: znsNamehash('testing.test.zil'),
      });

      const stub = sinonSandbox
        .stub(domain, 'getResolution')
        .returns(resolution);
      const stubSubdomain = sinonSandbox
        .stub(subdomain, 'getResolution')
        .returns(resolution);

      expect(getDomainResolution(domain)).to.deep.eq(resolution);
      expect(getDomainResolution(subdomain)).to.deep.eq(resolution);
      expect(stub).to.be.calledWith(
        Blockchain.ZIL,
        env.APPLICATION.ZILLIQA.NETWORK_ID,
      );
      expect(stubSubdomain).to.be.calledWith(
        Blockchain.ZIL,
        env.APPLICATION.ZILLIQA.NETWORK_ID,
      );
    });

    it('should return zil resolution for zil domain on uns', () => {
      const domain = new Domain({
        name: 'test.zil',
        node: '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
      });
      const resolution = new DomainsResolution({
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'zil' },
      });
      const subdomain = new Domain({
        name: 'testing.test.zil',
        node: znsNamehash('testing.test.zil'),
      });

      const stub = sinonSandbox
        .stub(domain, 'getResolution')
        .returns(resolution);
      const stubSubdomain = sinonSandbox
        .stub(subdomain, 'getResolution')
        .returns(resolution);

      expect(getDomainResolution(domain)).to.deep.eq(resolution);
      expect(getDomainResolution(subdomain)).to.deep.eq(resolution);
      expect(stub).to.be.calledWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      expect(stubSubdomain).to.be.calledWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
    });

    it('should return l2 resolution for uns domain', () => {
      const domain = new Domain({
        name: 'test.blockchain',
        node: '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
      });
      const l1resolution = new DomainsResolution({
        ownerAddress: Domain.NullAddress,
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        resolution: { test: 'eth' },
      });
      const l2resolution = new DomainsResolution({
        ownerAddress: '0x8aad44321a86b170879d7a244c1e8d360c99dda8',
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'matic' },
      });
      const subdomain = new Domain({
        name: 'subdomain.resolution-test.wallet',
        node: eip137Namehash('subdomain.resolution-test.wallet'),
      });
      const l1SubdomainResolution = new DomainsResolution({
        ownerAddress: Domain.NullAddress,
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        resolution: { test: 'eth' },
      });
      const l2SubdomainResolution = new DomainsResolution({
        ownerAddress: '0xA0a92d77D92934951F07E7CEb96a7f0ec387ebc1',
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'matic' },
      });

      const stub = sinonSandbox.stub(domain, 'getResolution');
      const subdomainStub = sinonSandbox.stub(subdomain, 'getResolution');
      stub
        .withArgs(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID)
        .returns(l1resolution);
      stub
        .withArgs(Blockchain.MATIC, env.APPLICATION.POLYGON.NETWORK_ID)
        .returns(l2resolution);
      subdomainStub
        .withArgs(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID)
        .returns(l1SubdomainResolution);
      subdomainStub
        .withArgs(Blockchain.MATIC, env.APPLICATION.POLYGON.NETWORK_ID)
        .returns(l2SubdomainResolution);

      expect(getDomainResolution(domain)).to.deep.eq(l2resolution);
      expect(getDomainResolution(subdomain)).to.deep.eq(l2SubdomainResolution);
      expect(stub).to.be.calledOnceWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      expect(subdomainStub).to.be.calledOnceWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
    });

    it('should return l1 resolution for uns domain', () => {
      const domain = new Domain({
        name: 'test.blockchain',
        node: '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
      });
      const subdomain = new Domain({
        name: 'subdomain.resolution-test.wallet',
        node: eip137Namehash('subdomain.resolution-test.wallet'),
      });

      const l1resolution = new DomainsResolution({
        ownerAddress: '0x8aad44321a86b170879d7a244c1e8d360c99dda8',
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        resolution: { test: 'eth' },
      });
      const l2resolution = new DomainsResolution({
        ownerAddress: Domain.NullAddress,
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'matic' },
      });

      const l1SubdomainResolution = new DomainsResolution({
        ownerAddress: '0xA0a92d77D92934951F07E7CEb96a7f0ec387ebc1',
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        resolution: { test: 'eth' },
      });
      const l2SubdomainResolution = new DomainsResolution({
        ownerAddress: Domain.NullAddress,
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'matic' },
      });

      const stub = sinonSandbox.stub(domain, 'getResolution');
      stub
        .withArgs(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID)
        .returns(l1resolution);
      stub
        .withArgs(Blockchain.MATIC, env.APPLICATION.POLYGON.NETWORK_ID)
        .returns(l2resolution);

      const subdomainStub = sinonSandbox.stub(subdomain, 'getResolution');
      subdomainStub
        .withArgs(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID)
        .returns(l1SubdomainResolution);
      subdomainStub
        .withArgs(Blockchain.MATIC, env.APPLICATION.POLYGON.NETWORK_ID)
        .returns(l2SubdomainResolution);

      expect(getDomainResolution(domain)).to.deep.eq(l1resolution);
      expect(stub).to.be.calledTwice;
      expect(stub).to.be.calledWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      expect(stub).to.be.calledWith(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );
      expect(getDomainResolution(subdomain)).to.deep.eq(l1SubdomainResolution);
      expect(subdomainStub).to.be.calledTwice;
      expect(subdomainStub).to.be.calledWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      expect(subdomainStub).to.be.calledWith(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );
    });
  });

  describe('getReverseResolution', () => {
    const l1ReverseAddr = '0x1234512345123451234512345123451234512345';
    const l1SubdomainReverseAddr = '0x1234512345123451234512345123451234512346';
    const l2ReverseAddr = '0x0000A0000A0000A0000A0000A0000A0000A0000A';
    const l2SubdomainReverseAddr = '0x0000A0000A0000A0000A0000A0000A0000A0000B';
    let l1Domain: Domain;
    let l2Domain: Domain;
    let l1Subdomain: Domain;
    let l2Subdomain: Domain;

    beforeEach(async () => {
      l1Domain = new Domain({
        name: 'test.blockchain',
        node: '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
      });
      const l1SubdomainNode = eip137Namehash('testing.test.blockchain');
      l1Subdomain = new Domain({
        name: 'testing.test.blockchain',
        node: l1SubdomainNode,
      });
      const l1Reverse = new DomainsReverseResolution({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        reverseAddress: l1ReverseAddr,
      });
      const l1SubdomainReverse = new DomainsReverseResolution({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        reverseAddress: l1SubdomainReverseAddr,
      });
      l1Domain.setReverseResolution(l1Reverse);
      l1Subdomain.setReverseResolution(l1SubdomainReverse);
      await l1Domain.save();
      await l1Subdomain.save();

      l2Domain = new Domain({
        name: 'test2.blockchain',
        node: '0xa6c1edadde6513c39db74fe3ee671b9bf5941eea3d316ee1fb5b779bae53a60d',
      });
      const l2SubdomainNode = eip137Namehash('testing2.test.blockchain');
      l2Subdomain = new Domain({
        name: 'testing2.test.blockchain',
        node: l2SubdomainNode,
      });
      const l2Reverse = new DomainsReverseResolution({
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        reverseAddress: l2ReverseAddr,
      });
      const l2SubdomainReverse = new DomainsReverseResolution({
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        reverseAddress: l2SubdomainReverseAddr,
      });
      l2Domain.setReverseResolution(l2Reverse);
      l2Subdomain.setReverseResolution(l2SubdomainReverse);
      await l2Domain.save();
      await l2Subdomain.save();
    });

    it('should return reverse resolution for l1', async () => {
      const [reverse] = await getReverseResolution([l1ReverseAddr]);
      const [reverseSubdomain] = await getReverseResolution([
        l1SubdomainReverseAddr,
      ]);

      expect(reverse?.domain?.name).to.equal(l1Domain.name);
      expect(reverseSubdomain?.domain?.name).to.equal(l1Subdomain.name);
    });

    it('should return reverse resolution for l2', async () => {
      const [reverse] = await getReverseResolution([l2ReverseAddr]);
      const [reverseSubdomain] = await getReverseResolution([
        l2SubdomainReverseAddr,
      ]);

      expect(reverse?.domain?.name).to.equal(l2Domain.name);
      expect(reverseSubdomain?.domain?.name).to.equal(l2Subdomain.name);
    });

    it('should prioritize l1 reverse resolution', async () => {
      const l2Reverse = l2Domain.getReverseResolution(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      if (l2Reverse) {
        l2Reverse.reverseAddress = l1ReverseAddr;
        await l2Domain.save();
      }

      const [reverse] = await getReverseResolution([l1ReverseAddr]);
      expect(reverse?.domain?.name).to.equal(l1Domain.name);
    });

    it('should return empty array if no reverse resolution', async () => {
      l2Domain.removeReverseResolution(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      await l2Domain.save();

      const reverse = await getReverseResolution([l2ReverseAddr]);
      expect(reverse).to.be.empty;
    });

    it('should return empty arrary for invalid address', async () => {
      const reverse = await getReverseResolution(['invalid']);
      expect(reverse).to.be.empty;
    });

    it('should not return domain.resolutions if withDomainResolutions is false', async () => {
      const [reverse1, reverse2, reverseSubdomain1, reverseSubdomain2] =
        await getReverseResolution([
          l1ReverseAddr,
          l2ReverseAddr,
          l1SubdomainReverseAddr,
          l2SubdomainReverseAddr,
        ]);

      expect(reverse1?.domain?.resolutions).to.be.empty;
      expect(reverse2?.domain?.resolutions).to.be.empty;
      expect(reverseSubdomain1?.domain?.resolutions).to.be.empty;
      expect(reverseSubdomain2?.domain?.resolutions).to.be.empty;
    });

    it('should return multiple reverse resolutions', async () => {
      const [reverse1, reverseSubdomain1, reverse2, reverseSubdomain2] =
        await getReverseResolution([
          l1ReverseAddr,
          l2ReverseAddr,
          l1SubdomainReverseAddr,
          l2SubdomainReverseAddr,
        ]);

      expect(reverse1?.domain?.name).to.equal(l1Domain.name);
      expect(reverse2?.domain?.name).to.equal(l2Domain.name);
      expect(reverseSubdomain1?.domain?.name).to.equal(l1Subdomain.name);
      expect(reverseSubdomain2?.domain?.name).to.equal(l2Subdomain.name);
    });
  });
});
