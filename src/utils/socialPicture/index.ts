import nodeFetch from 'node-fetch';
import { Domain, DomainsResolution } from '../../models';
import { createCanvas } from 'canvas';
import createSVGfromTemplate, { simpleSVGTemplate } from './svgTemplate';
import btoa from 'btoa';
import { env } from '../../env';
import { Storage } from '@google-cloud/storage';
import { fetchTokenMetadata } from '../../controllers/MetaDataController';
import { logger } from '../../logger';

const storageOptions = env.CLOUD_STORAGE.API_ENDPOINT_URL
  ? { apiEndpoint: env.CLOUD_STORAGE.API_ENDPOINT_URL } // for development using local emulator
  : {}; // for production
const storage = new Storage(storageOptions);

export const parsePictureRecord = (avatarRecord: string) => {
  const regex =
    /(\d+)\/(erc721|erc1155|cryptopunks):(0x[a-fA-F0-9]{40})\/(\d+)/;
  const matches = regex.exec(avatarRecord);
  if (!matches || matches.length !== 5) {
    throw new Error('Invalid avatar record');
  }
  const [, chainId, nftStandard, contractAddress, tokenId] = matches;

  return { chainId, nftStandard, contractAddress, tokenId };
};

const makeImageLink = (imageUrl: string) => {
  const PINATA_URL = 'https://gateway.pinata.cloud/ipfs/';
  const IPFS_REGEX = /^ipfs:\/\/(ipfs\/)?(.*$)/i;
  const [_url, _prefix, cid] = imageUrl.match(IPFS_REGEX) ?? [];

  if (cid) {
    return `https://ipfs.io/ipfs/${cid}`;
  }

  if (imageUrl.startsWith(PINATA_URL)) {
    return `https://ipfs.io/ipfs/${imageUrl.split(PINATA_URL)[1]}`;
  }

  if (
    imageUrl.includes('api.pudgypenguins.io/penguin/image') &&
    !imageUrl.endsWith('.svg')
  ) {
    return `${imageUrl}.svg`; // Fixes Pudgy Penguins bug, images missing .svg at the end
  }

  return imageUrl;
};

export const getNFTSocialPicture = async (
  pictureOrUrl: string,
): Promise<[string, string | null]> => {
  if (pictureOrUrl.startsWith('data:')) {
    const mimeType = pictureOrUrl.substring(
      pictureOrUrl.indexOf(':') + 1,
      pictureOrUrl.indexOf(';'),
    );
    const base64 = pictureOrUrl.substring(pictureOrUrl.indexOf('base64,') + 7);
    return [base64, mimeType];
  }

  const resp = await nodeFetch(makeImageLink(pictureOrUrl), { timeout: 5000 });
  if (!resp.ok) {
    throw new Error('Failed to fetch NFT image');
  }
  const data = await resp.buffer();
  const mimeType = resp.headers.get('Content-Type');
  const base64 = data.toString('base64');

  return [base64, mimeType];
};

const getFontSize = (name: string): number => {
  const [label] = name.split('.');
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  ctx.font = '18px Arial';
  const text = ctx.measureText(label);
  const fontSize = Math.floor(20 * ((360 - label.length) / text.width));

  if (fontSize > 58) {
    return 54;
  }

  if (fontSize < 21) {
    return 21;
  }

  return fontSize;
};

export const createSocialPictureImage = (
  domain: Domain,
  data: string,
  mimeType: string | null,
  backgroundColor: string,
  raw = false,
): string => {
  const fontSize = getFontSize(
    domain.name.split('.')[0].length > 45
      ? domain.name.substring(0, 45)
      : domain.name,
  );
  const svg = createSVGfromTemplate({
    background_color: backgroundColor,
    background_image: data,
    domain: domain.name,
    fontSize,
    mimeType: mimeType || undefined,
  });

  if (raw) {
    return svg;
  }

  try {
    return toBase64DataURI(svg);
  } catch (e) {
    console.log(e);
    return '';
  }
};

export const getNFTFilenameInCDN = (socialPic: string): string => {
  const { chainId, nftStandard, contractAddress, tokenId } =
    parsePictureRecord(socialPic);
  const nftPfpFolder = 'nft-pfp';
  return `${nftPfpFolder}/${chainId}_${nftStandard}:${contractAddress}_${tokenId}.svg`;
};

export const getNFTFilenameWithOverlayInCDN = (socialPic: string): string => {
  const { chainId, nftStandard, contractAddress, tokenId } =
    parsePictureRecord(socialPic);
  const nftPfpFolder = 'nft-pfp';
  return `${nftPfpFolder}/${chainId}_${nftStandard}:${contractAddress}_${tokenId}_overlay.svg`;
};

export const cacheSocialPictureInCDN = async (
  socialPic: string,
  domain: Domain,
  resolution: DomainsResolution,
): Promise<void> => {
  const fileName = getNFTFilenameInCDN(socialPic);
  const fileNameWithOverlay = getNFTFilenameWithOverlayInCDN(socialPic);
  const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
  const bucket = storage.bucket(bucketName);

  const [fileExists] = await bucket.file(fileName).exists();
  const [fileWithOverlayExists] = await bucket
    .file(fileNameWithOverlay)
    .exists();
  if (!fileExists || !fileWithOverlayExists) {
    const { fetchedMetadata, image } = await fetchTokenMetadata(resolution);
    const [imageData, mimeType] = await getNFTSocialPicture(image).catch(() => [
      '',
      null,
    ]);

    // upload images to bucket
    if (imageData) {
      if (!fileExists) {
        const imageDataSVG = simpleSVGTemplate(
          `data:${mimeType};base64,${imageData}`,
        );
        await uploadSVG(fileName, imageDataSVG);
      }

      if (!fileWithOverlayExists) {
        const withOverlayImageData = createSocialPictureImage(
          domain,
          imageData,
          mimeType,
          fetchedMetadata?.background_color || '',
          true,
        );
        await uploadSVG(fileNameWithOverlay, withOverlayImageData);
      }
    } else {
      logger.error(
        `Failed to generate image data for the domain: ${domain}, token URI: ${socialPic}`,
      );
    }
  }

  async function uploadSVG(fileName: string, imageData: string) {
    const file = bucket.file(fileName);
    // cache in the storage
    const imageBuffer = Buffer.from(imageData);
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/svg+xml',
      },
    });
  }
};

/**
 * Returns a social picture data string cached in CDN or null if image is not found in CDN cache.
 */
export const getNftPfpImageFromCDN = async (
  socialPic: string,
  withOverlay = false,
): Promise<string | null> => {
  const fileName = withOverlay
    ? getNFTFilenameWithOverlayInCDN(socialPic)
    : getNFTFilenameInCDN(socialPic);
  const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
  // const hostname = env.CLOUD_STORAGE.API_ENDPOINT_URL || 'https://storage.googleapis.com';
  const bucket = storage.bucket(bucketName);

  const [fileExists] = await bucket.file(fileName).exists();
  if (fileExists) {
    const contents = await bucket.file(fileName).download();
    return contents.toString(); // maybe replace this with stream buffer in the future
  } else {
    return null;
  }
};

export const toBase64DataURI = (svg: string): string => {
  // maybe use Buffer.from(data).toString('base64') instead of btoa(), which is deprecated in nodejs
  return (
    'data:image/svg+xml;base64,' +
    btoa(
      encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      }),
    )
  );
};
