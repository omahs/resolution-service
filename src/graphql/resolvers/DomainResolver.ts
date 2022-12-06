/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Resolver, Query, Arg } from 'type-graphql';
import { DomainResponse } from '../../controllers/dto/Domains';
import { Domain } from '../../models';
import { getDomainResolution } from '../../services/Resolution';
import { isSupportedTLD } from '../../utils/domain';

@Resolver()
export class DomainResolver {
  @Query(() => DomainResponse)
  async domains(@Arg('domainName') domainName: string) {
    const emptyResponse = {
      meta: {
        domain: domainName,
        owner: null,
        resolver: null,
        registry: null,
        blockchain: null,
        networkId: null,
        reverse: false,
      },
      records: {},
    };

    domainName = domainName.toLowerCase();
    const supportedTLD = isSupportedTLD(domainName);
    if (!supportedTLD) {
      return emptyResponse;
    }

    const domain = await Domain.findOne({
      where: { name: domainName },
      relations: ['resolutions', 'reverseResolutions'],
    });

    if (domain) {
      const resolution = getDomainResolution(domain);
      const response = new DomainResponse();
      response.meta = {
        domain: domain.name,
        blockchain: resolution.blockchain,
        networkId: resolution.networkId,
        owner: resolution.ownerAddress,
        resolver: resolution.resolver,
        registry: resolution.registry,
        reverse: domain.hasReverseResolution,
      };
      response.records = resolution.resolution;
      return response;
    }

    return {
      meta: {
        domain: domainName,
        owner: null,
        resolver: null,
        registry: null,
        blockchain: null,
        networkId: null,
        reverse: false,
      },
      records: {},
    };
  }
}
