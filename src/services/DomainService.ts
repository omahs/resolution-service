import { Domain } from '../models';
import { znsNamehash } from '../utils/namehash';
import {
  normalizeDomainOrToken,
  normalizeDomainName,
  IsZilDomain,
  isSupportedTLD,
} from '../utils/domain';
import { buildBatchLoader } from '../utils/batchLoader';

const domainsBatchLoader = buildBatchLoader(
  (keys: readonly string[]) =>
    Domain.findAllByNodes(keys as string[], undefined, true, [
      'resolutions',
      'reverseResolutions',
      'parent',
      'children',
    ]),
  (domain) => domain.node,
  {
    name: 'DomainServiceBatchLoader',
  },
);

export const findDomainByNameOrToken = async (
  domainOrToken: string,
): Promise<Domain | undefined> => {
  const tokenName = normalizeDomainOrToken(domainOrToken);
  const domainName = normalizeDomainName(domainOrToken);

  const [domain, znsDomain] = await domainsBatchLoader.loadMany([
    tokenName,
    ...(IsZilDomain(domainName) ? [znsNamehash(domainName)] : []),
  ]);
  const finalDomain =
    domain instanceof Domain
      ? domain
      : znsDomain instanceof Domain
      ? znsDomain
      : undefined;

  const supportedTLD = finalDomain ? isSupportedTLD(finalDomain.name) : false;
  if (!supportedTLD) {
    return undefined;
  }

  return finalDomain;
};
