import { Domain } from '../models';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import {
  normalizeDomainOrToken,
  normalizeDomainName,
  IsZilDomain,
  isSupportedTLD,
} from '../utils/domain';
import { env } from '../env';

const findByNode = async (node?: string): Promise<Domain | undefined> => {
  if (!node) {
    return undefined;
  }
  // use `find` instead of `findOne` to produce one SQL query instead of two:
  // https://github.com/typeorm/typeorm/issues/5694
  const domains = await Domain.find({
    where: { node },
    relations: ['resolutions', 'reverseResolutions', 'parent', 'children'],
    cache: env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME,
  });
  return domains.length > 0 ? domains[0] : undefined;
};

export const findDomainByNameOrToken = async (
  domainOrToken: string,
): Promise<Domain | undefined> => {
  const tokenName = normalizeDomainOrToken(domainOrToken);
  const domainName = normalizeDomainName(domainOrToken);

  let domain =
    (await findByNode(tokenName)) ||
    (await Domain.findOnChainNoSafe(tokenName));

  if (!domain && IsZilDomain(domainName)) {
    domain = await findByNode(znsNamehash(domainName));
  }
  const supportedTLD = domain ? isSupportedTLD(domain.name) : false;
  if (!supportedTLD) {
    return undefined;
  }

  return domain;
};
