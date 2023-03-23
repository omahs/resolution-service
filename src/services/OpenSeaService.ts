import { env } from '../env';
import fetch, { Headers, RequestInit, Response } from 'node-fetch';
import { logger } from '../logger';

export type OpenSeaAssetData = {
  image: string | undefined;
  background_color: string | undefined;
  owner_of: string | undefined;
};

export class OpenSeaService {
  private async logFailure(msg: string, res: Response): Promise<void> {
    const content = await res
      .text()
      .catch(() => '!Failed to get response text!');
    logger.warn(`${msg}: ${res.status} | ${content}`);
  }

  async getAsset(
    contractAddress: string,
    tokenId: string,
  ): Promise<OpenSeaAssetData> {
    const url = `${env.OPENSEA.BASE_URL}/asset/${encodeURIComponent(
      contractAddress,
    )}/${encodeURIComponent(tokenId)}`;
    logger.debug(`Fetching OpenSeaAsset: ${url}`);
    const reqOpts: RequestInit = {};
    if (!env.OPENSEA.IS_TESTNET) {
      // OS testnet API does not take an API key
      // and rejects any request that provides one with a 401
      reqOpts.headers = new Headers({
        'X-API-KEY': env.OPENSEA.API_KEY ?? '',
      });
    }
    const response = await fetch(url, reqOpts);

    if (!response.ok) {
      void this.logFailure('Failed to get OpenSea asset', response);
      throw new Error(
        `Failed to get OpenSea asset: ${response.status} | ${contractAddress} / ${tokenId}`,
      );
    }

    const data = await response.json();
    return {
      image: data.image_url?.endsWith('=s250')
        ? data.image_url.split('=s250')[0]
        : data.image_url,
      background_color: data.background_color,
      owner_of: data.owner?.address,
    };
  }
}
