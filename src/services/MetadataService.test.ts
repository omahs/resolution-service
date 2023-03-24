import { expect } from 'chai';
import sinon, { SinonStubbedInstance } from 'sinon';
import Moralis from 'moralis/node';
import { DomainsResolution } from '../models';
import AnimalDomainHelper from '../utils/AnimalDomainHelper/AnimalDomainHelper';
import { MetadataService } from './MetadataService';
import * as socialPictureUtility from '../utils/socialPicture';
import * as fetchModule from 'node-fetch';
import { Response } from 'node-fetch';
import { OpenSeaAssetData, OpenSeaService } from './OpenSeaService';

describe('Metadata service', () => {
  let uut: MetadataService;
  let animalHelperStub: AnimalDomainHelper;
  let openSeaServiceStub: SinonStubbedInstance<OpenSeaService>;

  beforeEach(async () => {
    animalHelperStub = sinon.createStubInstance(AnimalDomainHelper);
    openSeaServiceStub = sinon.createStubInstance(OpenSeaService);

    const fakeAsset: OpenSeaAssetData = {
      image: 'image url',
      background_color: '0xFAE243',
      owner_of: '0x10000000000000001',
    };

    openSeaServiceStub.fetchOpenSeaMetadata.resolves(fakeAsset);

    uut = new MetadataService(openSeaServiceStub, animalHelperStub);
  });

  describe('moralis', async () => {
    let moralis: Moralis;

    before(() => {
      sinon.replace(Moralis, 'start', sinon.fake());
    });

    it('instantiates Moralis on first occurrence', async () => {
      moralis = await uut.moralis();
      expect(moralis).to.not.be.null;
    });

    it('returns original moralis on subsequent calls', async () => {
      const secondMoralis = await uut.moralis();
      expect(moralis).to.deep.eq(secondMoralis);
    });
  });

  describe('fetchTokenMetadata', async () => {
    let resolution: DomainsResolution;

    beforeEach(() => {
      resolution = new DomainsResolution();
    });

    describe('and social picture value exists', async () => {
      beforeEach(() => {
        resolution.resolution['social.picture.value'] =
          'a social picture value';
      });

      describe('and chain is "eth"', async () => {
        beforeEach(() => {
          sinon.stub(socialPictureUtility, 'parsePictureRecord').returns({
            chainId: 'eth',
            nftStandard: 'ERC721',
            contractAddress: '0x0123809238423',
            tokenId: '0x1',
          });
        });

        afterEach(() => {
          (socialPictureUtility.parsePictureRecord as any).restore();
        });

        it('fetches metadata from OpenSea API', async () => {
          const expected = {
            fetchedMetadata: {
              background_color: '0xFAE243',
              image: 'image url',
              owner_of: '0x10000000000000001',
            },
            image: 'image url',
          };

          const result = await uut.fetchTokenMetadata(resolution);
          expect(result).to.deep.equal(expected);
        });
      });

      describe('and chain is not "eth"', async () => {
        const ownerAddress = '0x0wner';
        const moralisTokenUri = 'https://metadata.unstoppabledomains.com/42069';

        beforeEach(() => {
          sinon.stub(socialPictureUtility, 'parsePictureRecord').returns({
            chainId: '137',
            nftStandard: 'ERC1155',
            contractAddress: '0x0123809238400',
            tokenId: '0x1001',
          });

          const moralisResponse = {
            owner_of: ownerAddress,
            token_uri: moralisTokenUri,
            metadata: JSON.stringify({
              image: 'moralis image url',
              token_uri: moralisTokenUri,
            }),
          };

          const fakeMoralis: any = {
            Web3API: {
              token: {
                getTokenIdMetadata: sinon.fake.returns(moralisResponse),
              },
            },
          };

          sinon.stub(uut, 'moralis').returns(fakeMoralis);
        });

        afterEach(() => {
          (socialPictureUtility.parsePictureRecord as any).restore();
          (uut.moralis as any).restore();
        });

        describe('and is a valid NFT PFP', () => {
          beforeEach(() => {
            resolution.ownerAddress = ownerAddress;
          });

          describe('and Moralis has metadata', () => {
            describe('and the image property is present', () => {
              it('builds metadata with image from Moralis', async () => {
                const expected = {
                  fetchedMetadata: {
                    image: 'moralis image url',
                    token_uri: moralisTokenUri,
                  },
                  image: 'moralis image url',
                };

                const result = await uut.fetchTokenMetadata(resolution);
                expect(result).to.deep.equal(expected);
              });
            });

            describe('and the image property is not present', () => {
              beforeEach(() => {
                const moralisResponse = {
                  owner_of: ownerAddress,
                  token_uri: moralisTokenUri,
                  metadata: JSON.stringify({
                    token_uri: moralisTokenUri,
                  }),
                };

                const fakeMoralis: any = {
                  Web3API: {
                    token: {
                      getTokenIdMetadata: sinon.fake.returns(moralisResponse),
                    },
                  },
                };

                (uut.moralis as any).restore();
                sinon.stub(uut, 'moralis').returns(fakeMoralis);
              });

              it('fetches image from token uri', async () => {
                const tokenUriImage = 'token-uri image from moralis';
                const mockedResponse = {
                  image: tokenUriImage,
                };

                const stub = sinon.stub(fetchModule, 'default');
                stub.returns(
                  new Promise((resolve) =>
                    resolve(
                      new Response(JSON.stringify(mockedResponse), {
                        status: 200,
                      }),
                    ),
                  ),
                );

                const expected = {
                  fetchedMetadata: mockedResponse,
                  image: tokenUriImage,
                };

                const result = await uut.fetchTokenMetadata(resolution);
                expect(result).to.deep.equal(expected);
                stub.restore();
              });
            });
          });

          describe('and Moralis does not have metadata', () => {
            beforeEach(() => {
              const emptyMoralisResponse = {};

              const fakeMoralis: any = {
                Web3API: {
                  token: {
                    getTokenIdMetadata:
                      sinon.fake.returns(emptyMoralisResponse),
                  },
                },
              };

              (uut.moralis as any).restore();
              sinon.stub(uut, 'moralis').returns(fakeMoralis);
            });

            it('returns a falsey tuple', async () => {
              const expected = {
                fetchedMetadata: undefined,
                image: '',
              };

              const result = await uut.fetchTokenMetadata(resolution);
              expect(result).to.deep.equal(expected);
            });
          });
        });
      });
    });

    describe('and social picture does not exist', async () => {
      before(() => {
        delete resolution.resolution['social.picture.value']; // Necessary?
      });

      it('does not set chainId, contractAddress, or tokenId', async () => {
        const expected = {
          fetchedMetadata: undefined,
          image: '',
        };

        const result = await uut.fetchTokenMetadata(resolution);
        expect(result).to.deep.equal(expected);
      });
    });
  });
});
