import { Domain } from '../models';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import {
  normalizeDomainOrToken,
  normalizeDomainName,
  IsZilDomain,
  isSupportedTLD,
} from '../utils/domain';

export const findDomainByNameOrToken = async (
  domainOrToken: string,
): Promise<Domain | undefined> => {
  const tokenName = normalizeDomainOrToken(domainOrToken);
  const domainName = normalizeDomainName(domainOrToken);

  let domain =
    (await Domain.findByNode(tokenName, undefined, true)) ||
    (await Domain.findOnChainNoSafe(tokenName));

  if (!domain && IsZilDomain(domainName)) {
    domain = await Domain.findByNode(znsNamehash(domainName), undefined, true);
  }
  const supportedTLD = domain ? isSupportedTLD(domain.name) : false;
  if (!supportedTLD) {
    return undefined;
  }

  return domain;
};
