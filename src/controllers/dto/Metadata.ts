import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { OpenSeaMetadataAttribute } from '../../utils/AnimalDomainHelper/AnimalDomainHelper';

export type DomainProperties = {
  records: Record<string, string>;
};

export class Erc721Metadata {
  @IsString()
  name: string | null;

  @IsString()
  description: string | null;

  @IsString()
  image: string | null;

  @IsString()
  external_url: string | null;
}

export class OpenSeaMetadata extends Erc721Metadata {
  @IsOptional()
  @IsString()
  external_link?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsObject()
  properties: DomainProperties;

  @IsArray()
  attributes: Array<OpenSeaMetadataAttribute>;

  @IsOptional()
  @IsString()
  background_color?: string;

  @IsOptional()
  @IsString()
  animation_url?: string;

  @IsOptional()
  @IsString()
  youtube_url?: string;
}

export class TokenMetadata {
  @IsObject()
  fetchedMetadata: {
    name: string;
    token_uri?: string;
    metadata?: string;
    image?: string;
    background_color?: string;
  };

  @IsString()
  image: string;
}

export class ImageResponse {
  @IsOptional()
  @IsString()
  image?: string | null;

  @IsString()
  image_data: string;
}

export enum SupportedL2Chain {
  Polygon = 'polygon',
  Binance = 'bsc',
  Avalanche = 'avalanche',
  Fantom = 'fantom',
}

export enum NetworkId {
  Polygon = '137',
  Binance = '56',
  Avalanche = '43114',
  Fantom = '250',
}
