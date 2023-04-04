import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import Moralis from 'moralis/node';
import sinon from 'sinon';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { eip137Namehash } from '../utils/namehash';
import {
  DefaultImageData,
  BackgroundColor,
  DeprecatedBackgroundColor,
} from '../utils/generalImage';
import nock from 'nock';
import {
  getNSConfig,
  LayerTestFixture,
} from '../utils/testing/LayerFixturesHelper';
import {
  EthereumHelper,
  injectNetworkHelperConfig,
  resetNetworkHelperConfig,
} from '../utils/testing/EthereumTestsHelper';
import { Blockchain, UnstoppableDomainTlds } from '../types/common';
import { env } from '../env';
import Domain from '../models/Domain';
import {
  AttributeCharacterSet,
  DomainAttributeTrait,
  AttributeType,
  getAttributeCharacterSet,
} from '../utils/metadata';
import { toBase64DataURI } from '../utils/socialPicture';
import { commonParamsValidatorTestSuite } from './CommonTestSuites.test';

describe('MetaDataController', () => {
  const L1Fixture: LayerTestFixture = new LayerTestFixture();
  const L2Fixture: LayerTestFixture = new LayerTestFixture();

  before(async () => {
    await EthereumHelper.stopNetwork();
    await L1Fixture.setup(Blockchain.ETH, env.APPLICATION.ETHEREUM, {});

    // TODO: ask registry team to fix sandbox options
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

  beforeEach(() => {
    sinon.stub(Moralis, 'start').resolves();
  });

  after(async () => {
    await L1Fixture.networkHelper.stopNetwork();
    await L2Fixture.networkHelper.stopNetwork();
  });

  afterEach(() => {
    sinon.restore();
  });

  function commonCacheHeaderSuite(options: { basePath: string }) {
    const { basePath } = options;

    describe(`Cache header path: ${basePath}`, () => {
      it('should set cache header on valid request', async () => {
        const response = await supertest(api)
          .get(`${basePath}/test.crypto`)
          .send();

        expect(response.statusCode).to.equal(200);
        expect(response.headers['surrogate-control']).to.equal('max-age=1800');
      });

      it('should not set cache header on invalid request', async () => {
        const response = await supertest(api)
          .get(`${basePath}/test.json`)
          .send();

        expect(response.headers['surrogate-control']).to.not.exist;
        expect(response.statusCode).to.equal(400);
      });
    });
  }

  describe('HEAD', () => {
    let dummyDomainName: string;

    beforeEach(() => {
      dummyDomainName = 'unstoppable.crypto';
    });

    describe('/metadata/:domainOrToken', () => {
      it('should return empty body', async () => {
        const response = await supertest(api)
          .head(`/metadata/${dummyDomainName}`)
          .send()
          .then((r) => r);

        const emptyBody = {};
        expect(response.body).to.be.deep.equal(emptyBody);
      });
    });

    describe('/image/:domainOrToken', () => {
      it('should return empty body', async () => {
        const response = await supertest(api)
          .head(`/image/${dummyDomainName}`)
          .send()
          .then((r) => r);

        const emptyBody = {};
        expect(response.body).to.be.deep.equal(emptyBody);
      });
    });
  });

  describe('GET /metadata/:domainOrToken', () => {
    commonParamsValidatorTestSuite({
      getPath: (domainName: string) => `/metadata/${domainName}`,
      includeDomainNameTests: true,
      includeTokenTests: true,
    });

    commonCacheHeaderSuite({
      basePath: '/metadata',
    });

    it('should work', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        resolution: {
          'crypto.BTC.address': 'beabbeabbeabeabeabeabeabeabeabeabeabeabeab',
          'crypto.ETH.address': '0xdeadeadeadeadeadeadeadeadeadeadeadeadead',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
        },
      });
      const resWithName = await supertest(api)
        .get(`/metadata/${domain.name}`)
        .send()
        .then((r) => r.body);

      const resWithToken = await supertest(api)
        .get(`/metadata/${domain.node}`)
        .send()
        .then((r) => r.body);

      expect(resWithName).to.be.deep.equal(resWithToken);
      expect(resWithName.name).eq(domain.name);
      expect(resWithName.description).eq(
        'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.\nhttps://gateway.pinata.cloud/ipfs/QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
      );
      expect(resWithName.external_url).eq(
        'https://unstoppabledomains.com/search?searchTerm=testdomain.crypto',
      );
      expect(resWithName.image).eq(
        'https://metadata.unstoppabledomains.com/image-src/testdomain.crypto.svg',
      );
      const correctAttributes = [
        { trait_type: DomainAttributeTrait.Level, value: 2 },
        { trait_type: DomainAttributeTrait.Ending, value: 'crypto' },
        { trait_type: DomainAttributeTrait.Length, value: 10 },
        { trait_type: DomainAttributeTrait.Subdomains, value: 0 },
        {
          trait_type: DomainAttributeTrait.Type,
          value: AttributeType.Standard,
        },
        {
          trait_type: DomainAttributeTrait.AttributeCharacterSet,
          value: AttributeCharacterSet.Letter,
        },
      ];
      expect(resWithName.attributes.length).eq(correctAttributes.length);
      expect(resWithName.attributes).to.have.deep.members(correctAttributes);
      expect(resWithName.background_color).eq(BackgroundColor);
    });

    describe('GET /image-src/:domainOrToken', () => {
      commonParamsValidatorTestSuite({
        getPath: (domainName: string) => `/image-src/${domainName}`,
        includeDomainNameTests: true,
        includeTokenTests: true,
      });

      commonCacheHeaderSuite({
        basePath: '/image-src',
      });

      it('should throw an error if invalid image extension is supplied', async () => {
        const response = await supertest(api)
          .get('/image-src/test.crypto.jpeg')
          .send();

        expect(response.statusCode).to.equal(400);
        expect(response.body.code).to.equal('InvalidInputError');
        expect(response.body.message).to.equal('Unsupported TLD');
      });
    });

    it('should work with a subdomain', async () => {
      const name = 'sub.domain.crypto';
      const node = eip137Namehash(name);
      const { domain } = await DomainTestHelper.createTestDomain({
        name,
        node,
      });
      const resWithName = await supertest(api)
        .get(`/metadata/${domain.name}`)
        .send()
        .then((r) => r.body);

      const resWithToken = await supertest(api)
        .get(`/metadata/${domain.node}`)
        .send()
        .then((r) => r.body);

      expect(resWithName).to.be.deep.equal(resWithToken);
      expect(resWithName.name).eq(domain.name);
      expect(resWithName.description).eq(
        'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
      );
      expect(resWithName.external_url).eq(
        'https://unstoppabledomains.com/search?searchTerm=sub.domain.crypto',
      );
      expect(resWithName.image).eq(
        'https://metadata.unstoppabledomains.com/image-src/sub.domain.crypto.svg',
      );
      const correctAttributesForSubdomain = [
        { trait_type: DomainAttributeTrait.Level, value: 3 },
        { trait_type: DomainAttributeTrait.Ending, value: 'crypto' },
        { trait_type: DomainAttributeTrait.Length, value: 10 },
        {
          trait_type: DomainAttributeTrait.Type,
          value: AttributeType.Subdomain,
        },
        { trait_type: DomainAttributeTrait.Subdomains, value: 0 },

        {
          trait_type: DomainAttributeTrait.AttributeCharacterSet,
          value: AttributeCharacterSet.Letter,
        },
      ];
      expect(resWithName.attributes.length).eq(
        correctAttributesForSubdomain.length,
      );
      expect(resWithName.attributes).to.have.deep.members(
        correctAttributesForSubdomain,
      );
    });
    it('should return subdomains count for parent', async () => {
      const name = 'domain.crypto';
      const node = eip137Namehash(name);
      const { domain } = await DomainTestHelper.createTestDomain({
        name,
        node,
      });
      const subdomainName = 'sub.domain.crypto';
      const { domain: subdomain } = await DomainTestHelper.createTestDomain({
        name: subdomainName,
        node: eip137Namehash(subdomainName),
      });
      subdomain.parent = domain;
      await subdomain.save();
      const resWithName = await supertest(api)
        .get(`/metadata/${domain.name}`)
        .send()
        .then((r) => r.body);

      const resWithToken = await supertest(api)
        .get(`/metadata/${domain.node}`)
        .send()
        .then((r) => r.body);

      expect(resWithName).to.be.deep.equal(resWithToken);
      expect(resWithName.name).eq(domain.name);
      const correctAttributesForParent = [
        { trait_type: DomainAttributeTrait.Level, value: 2 },
        { trait_type: DomainAttributeTrait.Ending, value: 'crypto' },
        { trait_type: DomainAttributeTrait.Length, value: 6 },
        {
          trait_type: DomainAttributeTrait.Type,
          value: AttributeType.Standard,
        },
        { trait_type: DomainAttributeTrait.Subdomains, value: 1 },

        {
          trait_type: DomainAttributeTrait.AttributeCharacterSet,
          value: AttributeCharacterSet.Letter,
        },
      ];
      expect(resWithName.attributes.length).eq(
        correctAttributesForParent.length,
      );
      expect(resWithName.attributes).to.have.deep.members(
        correctAttributesForParent,
      );
    });

    it.skip('should render a deprecated image placeholder for .coin domain', async () => {
      const name = 'deprecated.coin';
      const node = eip137Namehash(name);
      const { domain } = await DomainTestHelper.createTestDomain({
        name,
        node,
        resolution: {
          'social.picture.value':
            '1/erc721:0xbd3531da5cf5857e7cfaa92426877b022e612cf8/395',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
        },
      });
      const resWithName = await supertest(api)
        .get(`/metadata/${domain.name}`)
        .send()
        .then((r) => r.body);

      const resWithToken = await supertest(api)
        .get(`/metadata/${domain.node}`)
        .send()
        .then((r) => r.body);

      expect(resWithName).to.be.deep.equal(resWithToken);
      expect(resWithName.name).eq(domain.name);
      expect(resWithName.description).eq(
        '.coin domains are no longer supported by Unstoppable Domains. As a result, records of such domains cannot be updated. Learn more at our blog: https://unstoppabledomains.com/blog/coin. \nhttps://gateway.pinata.cloud/ipfs/QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
      );
      expect(resWithName.external_url).eq(
        `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      );
      // Forcing a default placeholder image over user-uploaded NFT, specifically for .coin deprecation,
      // since users cannot update domain records at UD anymore
      expect(resWithName.image).eq(
        `https://metadata.unstoppabledomains.com/image-src/${domain.name}.svg`,
      );
      const correctAttributes = [
        { trait_type: DomainAttributeTrait.Level, value: 2 },
        {
          trait_type: DomainAttributeTrait.Ending,
          value: UnstoppableDomainTlds.Coin,
        },
        { trait_type: DomainAttributeTrait.Length, value: 10 },
        { trait_type: DomainAttributeTrait.Subdomains, value: 0 },
        {
          trait_type: DomainAttributeTrait.Type,
          value: AttributeType.Standard,
        },
        {
          trait_type: DomainAttributeTrait.AttributeCharacterSet,
          value: AttributeCharacterSet.Letter,
        },
      ];
      expect(resWithName.attributes.length).eq(correctAttributes.length);
      expect(resWithName.attributes).to.have.deep.members(correctAttributes);
      expect(resWithName.image_data).eq(
        toBase64DataURI(
          DefaultImageData({
            domain,
            fontSize: 24,
          }),
        ),
      );
      expect(resWithName.background_color).eq(DeprecatedBackgroundColor);
    });

    it('should work with animal domain', async () => {
      nock('https://storage.googleapis.com')
        .get('/dot-crypto-metadata-api/images/animals/lemming.svg')
        .twice()
        .reply(200, 'correctImageData');

      const { domain: animalDomain } = await DomainTestHelper.createTestDomain({
        name: 'unstoppablelemming.crypto',
        node: '0xccfd2756994b2ea38fcd2deaf3ae2b2a4678fce6e81fbe4f856ceb0cb50dfee9',
        ownerAddress: '0xe7474d07fd2fa286e7e0aa23cd107f8379085037',
        resolution: {
          'crypto.ETH.address': '0xe7474D07fD2FA286e7e0aa23cd107F8379085037',
        },
      });

      const response = await supertest(api)
        .get(`/metadata/${animalDomain.name}`)
        .send()
        .then((r) => r.body);

      const responseWithToken = await supertest(api)
        .get(`/metadata/${animalDomain.node}`)
        .send()
        .then((r) => r.body);

      expect(response).to.deep.eq(responseWithToken);
      expect(response.name).to.eq(animalDomain.name);
      expect(response.description).to.eq(
        'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
      );
      expect(response.external_url).to.eq(
        'https://unstoppabledomains.com/search?searchTerm=unstoppablelemming.crypto',
      );
      expect(response.image).to.eq(
        `https://metadata.unstoppabledomains.com/image-src/${animalDomain.name}.svg`,
      );

      const correctAttributes = [
        {
          trait_type: DomainAttributeTrait.Level,
          value: 2,
        },
        {
          trait_type: DomainAttributeTrait.Ending,
          value: 'crypto',
        },
        {
          trait_type: DomainAttributeTrait.Length,
          value: 18,
        },
        {
          trait_type: DomainAttributeTrait.Type,
          value: AttributeType.Animal,
        },
        {
          trait_type: DomainAttributeTrait.Subdomains,
          value: 0,
        },
        {
          trait_type: DomainAttributeTrait.AttributeCharacterSet,
          value: AttributeCharacterSet.Letter,
        },
      ];
      expect(response.attributes.length).to.eq(correctAttributes.length);
      expect(response.attributes).to.have.deep.members(correctAttributes);
      expect(response.background_color).to.eq('4C47F7');
    });

    it('should return branded animal domain metadata', async () => {
      nock('https://storage.googleapis.com')
        .get('/dot-crypto-metadata-api/images/trust/bear.svg')
        .reply(200, '');

      const { domain: animalDomain } = await DomainTestHelper.createTestDomain({
        name: 'trustbear.crypto',
        node: '0x329b868d34359c1961358088be9bfbd21e65eb8ab95e90b21e50d99c02b34c72',
      });
      const expectedImageUrl = `https://metadata.unstoppabledomains.com/image-src/${animalDomain.name}.svg`;
      const response = await supertest(api)
        .get(`/metadata/${animalDomain.name}`)
        .send()
        .then((r) => r.body);
      expect(response.image).to.equal(expectedImageUrl);
      expect(response.attributes).to.deep.equal([
        { trait_type: DomainAttributeTrait.Ending, value: 'crypto' },
        { trait_type: DomainAttributeTrait.Level, value: 2 },
        { trait_type: DomainAttributeTrait.Length, value: 9 },
        {
          trait_type: DomainAttributeTrait.Subdomains,
          value: 0,
        },
        { trait_type: DomainAttributeTrait.Type, value: AttributeType.Animal },
        {
          trait_type: DomainAttributeTrait.AttributeCharacterSet,
          value: AttributeCharacterSet.Letter,
        },
      ]);
    });

    it('should return default response for unknown domain/token', async () => {
      const response = await supertest(api)
        .get('/metadata/unknown.crypto')
        .send()
        .then((r) => r.body);
      expect(response).to.deep.eq({
        name: 'unknown.crypto',
        tokenId: null,
        namehash: null,
        description:
          'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
        external_url:
          'https://unstoppabledomains.com/search?searchTerm=unknown.crypto',
        image:
          'https://metadata.unstoppabledomains.com/image-src/unknown.crypto.svg',
        attributes: [
          { trait_type: DomainAttributeTrait.Ending, value: 'crypto' },
          { trait_type: DomainAttributeTrait.Level, value: 2 },
          { trait_type: DomainAttributeTrait.Length, value: 7 },
          { trait_type: DomainAttributeTrait.Subdomains, value: 0 },
          {
            trait_type: DomainAttributeTrait.Type,
            value: AttributeType.Standard,
          },
          {
            trait_type: DomainAttributeTrait.AttributeCharacterSet,
            value: AttributeCharacterSet.Letter,
          },
        ],
      });
      const token = eip137Namehash('unknown.crypto');
      const responseWithNode = await supertest(api)
        .get(`/metadata/${token}`)
        .send()
        .then((r) => r.body);
      expect(responseWithNode).to.deep.eq({
        name: null,
        tokenId: null,
        namehash: null,
        description: null,
        external_url: null,
        image: null,
        attributes: [],
      });
    });

    it('should work with special domains', async () => {
      const CUSTOM_IMAGE_URL =
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/custom' as const;
      const domainsWithCustomImage: Record<string, string> = {
        'code.crypto': 'code.svg',
        'web3.crypto': 'web3.svg',
        'privacy.crypto': 'privacy.svg',
        'surf.crypto': 'surf.svg',
        'hosting.crypto': 'hosting.svg',
        'india.crypto': 'india.jpg',
      };
      const specialLabels = [
        'code',
        'web3',
        'privacy',
        'surf',
        'hosting',
        'india',
      ];
      const specialDomains = await Promise.all(
        specialLabels.map((label) => {
          const domain = `${label}.crypto`;

          return DomainTestHelper.createTestDomain({
            name: domain,
            node: eip137Namehash(domain),
            resolution:
              label === 'india'
                ? {
                    'ipfs.html.value':
                      'QmQq1ydvSmzrZPkr4CJJtetNSb9eSBucqQ4QoNmiRdMHzM',
                  }
                : {},
          });
        }),
      );

      for (const { domain } of specialDomains) {
        const response = await supertest(api)
          .get(`/metadata/${domain.name}`)
          .send()
          .then((r) => r.body);

        expect(response.name).to.eq(domain.name);
        if (domain.name === 'india.crypto') {
          expect(response.description).to.eq(
            'This exclusive art piece by Amrit Pal Singh features hands of different skin tones spelling out the word HOPE in sign language. Hope embodies people coming together and having compassion for others in a way that transcends geographical borders. This art is a reminder that, while one individual can’t uplift humanity on their own, collective and inclusive efforts give rise to meaningful change.\nhttps://gateway.pinata.cloud/ipfs/QmQq1ydvSmzrZPkr4CJJtetNSb9eSBucqQ4QoNmiRdMHzM',
          );
        } else {
          expect(response.description).to.eq(
            'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
          );
        }
        expect(response.external_url).to.eq(
          `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
        );
        expect(response.image).to.eq(
          `https://metadata.unstoppabledomains.com/image-src/${domain.name}.svg`,
        );
        const correctAttributes = [
          { trait_type: DomainAttributeTrait.Ending, value: 'crypto' },
          {
            trait_type: DomainAttributeTrait.Level,
            value: 2,
          },
          {
            trait_type: DomainAttributeTrait.Length,
            value: domain.label.length,
          },
          { trait_type: DomainAttributeTrait.Subdomains, value: 0 },
          {
            trait_type: DomainAttributeTrait.Type,
            value: AttributeType.Standard,
          },
          {
            trait_type: DomainAttributeTrait.AttributeCharacterSet,
            value: getAttributeCharacterSet(domain),
          },
        ];
        expect(response.attributes.length).to.eq(correctAttributes.length);
        expect(response.attributes).to.have.deep.members(correctAttributes);
      }
    });

    it('should return the same attributes regardless of what record key is used for ipfs', async () => {
      const { domain: domainHtmlValue } =
        await DomainTestHelper.createTestDomain({
          resolution: { 'ipfs.html.value': 'ipfs hash content' },
        });
      const { domain: domainDwebHash } =
        await DomainTestHelper.createTestDomain({
          name: 'testdomain2.crypto',
          node: eip137Namehash('testdomain2.crypto'),
          resolution: { 'dweb.ipfs.hash': 'ipfs hash content' },
        });

      const htmlValueResponse = await supertest(api)
        .get(`/metadata/${domainHtmlValue.name}`)
        .send()
        .then((r) => r.body);

      const dwebHashResponse = await supertest(api)
        .get(`/metadata/${domainDwebHash.name}`)
        .send()
        .then((r) => r.body);

      expect(dwebHashResponse.attributes).to.deep.contain({
        trait_type: DomainAttributeTrait.Ending,
        value: 'crypto',
      });
    });

    describe('GET /image/:domainOrToken', () => {
      commonParamsValidatorTestSuite({
        getPath: (domainName: string) => `/image/${domainName}`,
        includeDomainNameTests: true,
        includeTokenTests: true,
      });

      commonCacheHeaderSuite({
        basePath: '/image',
      });

      it('should resolve image_data with provided domain', async () => {
        const { domain } = await DomainTestHelper.createTestDomain({});
        const res = await supertest(api)
          .get(`/image/${domain.name}`)
          .send()
          .then((r) => r.body);
        const defaultImageData = DefaultImageData({
          domain,
          fontSize: 24,
        });
        expect(res.image_data).to.equal(defaultImageData);
      });

      it('should resolve image_data with provided tokenId', async () => {
        const { domain } = await DomainTestHelper.createTestDomain({});
        const res = await supertest(api)
          .get(`/image/${domain.node}`)
          .send()
          .then((r) => r.body);
        const defaultImageData = DefaultImageData({
          domain,
          fontSize: 24,
        });
        expect(res.image_data).to.equal(defaultImageData);
      });

      it(`should resolve image_data as animal domain`, async () => {
        nock('https://storage.googleapis.com')
          .get('/dot-crypto-metadata-api/images/animals/lemming.svg')
          .reply(200, 'correct image data');

        const { domain } = await DomainTestHelper.createTestDomain({
          name: 'unstoppablelemming.crypto',
          node: eip137Namehash('unstoppablelemming.crypto'),
        });

        const res = await supertest(api)
          .get(`/image/${domain.name}`)
          .send()
          .then((r) => r.body);

        expect(res.image_data).to.equal('correct image data');
      });

      it('should return null value when no domain is found', async () => {
        const response = await supertest(api)
          .get('/image/unknown.crypto')
          .send()
          .then((r) => r.body);
        expect(response).to.deep.eq({
          image_data: DefaultImageData({
            domain: new Domain({ name: 'unknown.crypto' }),
            fontSize: 24,
          }),
        });
        const token = eip137Namehash('unknown.crypto');
        const responseWithNode = await supertest(api)
          .get(`/image/${token}`)
          .send()
          .then((r) => r.body);
        expect(responseWithNode).to.deep.eq({
          image_data: '',
        });
      });
    });
  });
});
