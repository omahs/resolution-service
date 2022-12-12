import { BigNumber } from 'ethers';
import { In } from 'typeorm';

import { env } from '../env';
import { Domain, DomainsResolution, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import { isSupportedTLD } from '../utils/domain';
import { ETHAddressRegex } from '../utils/ethersUtils';

export function getTokenIdFromHash(hash: string): string {
  return BigNumber.from(hash).toString();
}

export function IsZilDomain(name: string): boolean {
  const tokens = name.split('.');
  const tld = tokens[tokens.length - 1];
  return tld === 'zil';
}

function isNullAddress(address: string | null): boolean {
  return address === null || address === Domain.NullAddress;
}

export function getDomainResolution(domain: Domain): DomainsResolution {
  let resolution: DomainsResolution;
  resolution = domain.getResolution(
    Blockchain.MATIC,
    env.APPLICATION.POLYGON.NETWORK_ID,
  );

  if (isNullAddress(resolution.ownerAddress)) {
    resolution = domain.getResolution(
      Blockchain.ETH,
      env.APPLICATION.ETHEREUM.NETWORK_ID,
    );
  }

  if (isNullAddress(resolution.ownerAddress) && IsZilDomain(domain.name)) {
    resolution = domain.getResolution(
      Blockchain.ZIL,
      env.APPLICATION.ZILLIQA.NETWORK_ID,
    );
  }
  return resolution;
}

/**
 * Get reverse resolution for a given ETH wallet address
 * @param addresses ETH wallet address
 * @param options
 * @param options.cache caching the query for 10 mins
 * @param options.withDomainResolutions BE CAREFUL to use the `withDomainResolutions` option.
 * If it's set to `false`, it won't contain `domain.resolutions`
 * data. Only set to `false` for faster query and make sure
 * you don't need `domain.resolutions`.
 * @returns DomainsReverseResolution that may or may not contain `domain.resolutions`
 * depending on `options.withDomainResolutions`
 */
export async function getReverseResolution(
  addresses: string[],
  options: {
    cache?: boolean;
    withDomainResolutions?: boolean;
  } = {
    cache: false,
    withDomainResolutions: true,
  },
): Promise<DomainsReverseResolution[]> {
  const { cache, withDomainResolutions } = options;
  const validAddresses = addresses.filter((addr) =>
    addr.match(ETHAddressRegex),
  );
  const addressSet = new Set(validAddresses); // remove duplicate
  const addressArr = [...addressSet];

  const reverseOnETH = await DomainsReverseResolution.find({
    where: {
      networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      blockchain: Blockchain.ETH,
      reverseAddress: In(addressArr),
    },
    relations: [
      'domain',
      ...(withDomainResolutions ? ['domain.resolutions'] : []),
    ],
    cache: cache ? env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME : undefined,
  });

  const addressOnETH = reverseOnETH.map((reverse) => reverse.reverseAddress);
  const addressOnETHSet = new Set(addressOnETH); // turn into a set for O(1) lookup
  const addressNotOnETH = addressArr.filter(
    (address) => !addressOnETHSet.has(address),
  );

  const reverseOnMATIC = await DomainsReverseResolution.find({
    where: {
      networkId: env.APPLICATION.POLYGON.NETWORK_ID,
      blockchain: Blockchain.MATIC,
      reverseAddress: In(addressNotOnETH),
    },
    relations: [
      'domain',
      ...(withDomainResolutions ? ['domain.resolutions'] : []),
    ],
    cache: cache ? env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME : undefined,
  });

  return [...reverseOnETH, ...reverseOnMATIC].filter((reverse) =>
    isSupportedTLD(reverse.domain.name),
  );
}
