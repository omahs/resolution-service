import {
  Controller,
  Get,
  Head,
  Header,
  Param,
  QueryParam,
  UseBefore,
} from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import {
  BackgroundColor,
  DeprecatedBackgroundColor,
} from '../utils/generalImage';
import { UnstoppableDomainTlds } from '../types/common';
import { pathThatSvg } from 'path-that-svg';

import { env } from '../env';
import { checkNftPfpImageExistFromCDN } from '../utils/socialPicture';
import {
  getDomainResolution,
  getTokenIdFromHash,
} from '../services/Resolution';
import { MetadataService } from '../services/MetadataService';
import { ImageResponse, OpenSeaMetadata } from './dto/Metadata';

import { belongsToTld, isDeprecatedTLD } from '../utils/domain';
import { findDomainByNameOrToken } from '../services/DomainService';
import { ValidateAndTransformOnDomainNameOrToken } from '../middleware/inputValidators';

import RateLimiter from '../middleware/RateLimiter';

const INVALID_DOMAIN_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/invalid-domain.svg` as const;
const METADATA_MAX_REQUESTS =
  env.APPLICATION.RATE_LIMITER.METADATA_MAX_REQUESTS;

@Controller()
@UseBefore(RateLimiter({ max: METADATA_MAX_REQUESTS }))
export class MetaDataController {
  private metadataService: MetadataService;

  constructor() {
    // TODO: Implement DI once its ready
    this.metadataService = new MetadataService(null, null);
  }

  @Get('/deaddata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async getDeadData(): Promise<{
    name: string;
    description: string;
    image: string;
    background_color: string;
  }> {
    const description = 'This domain is invalid';

    return {
      name: 'INVALID DOMAIN',
      description,
      image: INVALID_DOMAIN_IMAGE_URL,
      background_color: 'FFFFFF',
    };
  }

  @Head('/metadata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async headMetaData(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ) {
    return {};
  }

  @Get('/metadata/:domainOrToken')
  @UseBefore(ValidateAndTransformOnDomainNameOrToken('domainOrToken'))
  @ResponseSchema(OpenSeaMetadata)
  async getMetaData(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<OpenSeaMetadata> {
    const domain = await findDomainByNameOrToken(domainOrToken);
    if (!domain) {
      return this.metadataService.defaultMetaResponse(domainOrToken);
    }
    const resolution = getDomainResolution(domain);

    const socialPictureValue = isDeprecatedTLD(domain.name)
      ? ''
      : resolution.resolution['social.picture.value'];

    // we consider that NFT picture is verified if the picture is present in our CDN cache.
    // It means it was verified before caching.
    const isSocialPictureVerified =
      Boolean(socialPictureValue) &&
      (await checkNftPfpImageExistFromCDN(
        socialPictureValue,
        withOverlay ? domain.name : undefined,
      ));
    const description = this.metadataService.getDomainDescription(
      domain,
      resolution.resolution,
    );
    const DomainAttributeTrait = await this.metadataService.getAttributeType(
      domain,
      {
        verifiedNftPicture: isSocialPictureVerified,
      },
    );
    const imageUrl = this.metadataService.generateDomainImageUrl(domain.name);
    const metadata: OpenSeaMetadata = {
      name: domain.name,
      tokenId: getTokenIdFromHash(domain.node),
      namehash: domain.node,
      description,
      properties: {
        records: resolution.resolution,
      },
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image: imageUrl,
      image_url: imageUrl,
      attributes: DomainAttributeTrait,
    };

    if (
      !this.metadataService.isDomainWithCustomImage(domain.name) &&
      !socialPictureValue
    ) {
      metadata.background_color = isDeprecatedTLD(domain.name)
        ? DeprecatedBackgroundColor
        : BackgroundColor;
    }

    return metadata;
  }

  @Head('/image/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async headImage(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ) {
    return {};
  }

  @Get('/image/:domainOrToken')
  @UseBefore(ValidateAndTransformOnDomainNameOrToken('domainOrToken'))
  @ResponseSchema(ImageResponse)
  async getImage(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<ImageResponse> {
    const domain = await findDomainByNameOrToken(domainOrToken);
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken;

    if (!name.includes('.')) {
      return { image_data: '' };
    }

    if (domain && resolution && !isDeprecatedTLD(domain.name)) {
      const socialPictureValue = resolution.resolution['social.picture.value'];
      const pfpImageFromCDN =
        socialPictureValue &&
        (await this.metadataService.getOrCacheNowPfpNFT(
          socialPictureValue,
          domain,
          resolution,
          withOverlay,
        ));

      return {
        image_data:
          pfpImageFromCDN ||
          (await this.metadataService.generateImageData(
            name,
            resolution?.resolution || {},
          )),
      };
    }

    return {
      image_data: await this.metadataService.generateImageData(
        name,
        resolution?.resolution || {},
      ),
    };
  }

  @Get('/image-src/:domainOrToken')
  @Header('Access-Control-Allow-Origin', '*')
  @UseBefore(ValidateAndTransformOnDomainNameOrToken('domainOrToken', ['svg']))
  @Header('Content-Type', 'image/svg+xml')
  async getImageSrc(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<string> {
    const SVG_SUFFIX = '.svg';
    const domainOrTokenSanitized = domainOrToken.endsWith(SVG_SUFFIX)
      ? domainOrToken.substring(0, domainOrToken.length - SVG_SUFFIX.length) // remove the .svg suffix
      : domainOrToken;

    const domain = await findDomainByNameOrToken(domainOrTokenSanitized);
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrTokenSanitized;

    if (!name.includes('.')) {
      return '';
    }

    if (
      domain &&
      resolution &&
      !belongsToTld(domain.name, UnstoppableDomainTlds.Coin)
    ) {
      const socialPictureValue = resolution.resolution['social.picture.value'];
      const pfpImageFromCDN =
        socialPictureValue &&
        (await this.metadataService.getOrCacheNowPfpNFT(
          socialPictureValue,
          domain,
          resolution,
          withOverlay,
        ));

      return (
        pfpImageFromCDN ||
        (await pathThatSvg(
          await this.metadataService.generateImageData(
            name,
            resolution?.resolution || {},
          ),
        ))
      );
    }

    return await pathThatSvg(
      await this.metadataService.generateImageData(
        name,
        resolution?.resolution || {},
      ),
    );
  }
}
