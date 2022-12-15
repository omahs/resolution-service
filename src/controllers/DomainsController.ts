import 'reflect-metadata';
import { Response } from 'express';
import {
  Get,
  JsonController,
  Param,
  Params,
  QueryParams,
  Res,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import {
  DomainResponse,
  DomainsListQuery,
  DomainsListResponse,
  UnsDomainQuery,
  DomainLatestTransferResponse,
  DomainsRecordsQuery,
  DomainsRecordsResponse,
  DomainRecords,
} from './dto/Domains';
import { CnsRegistryEvent, Domain } from '../models';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { getDomainResolution } from '../services/Resolution';
import { IsZilDomain } from '../utils/domain';
import { ConvertArrayQueryParams } from '../middleware/ConvertArrayQueryParams';
import RateLimiter from '../middleware/RateLimiter';
import { AttachHeapTrackingMiddleware } from '../middleware/SendHeapEvent';
import { In } from 'typeorm';
import pick from 'lodash/pick';
import {
  isSupportedTLD,
  normalizeDomainName,
  normalizeDomainOrToken,
} from '../utils/domain';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import { DeadAdresses } from '../types/common';
import { HeapEvents } from '../types/heap';
import { env } from '../env';
import { getTokenIdFromHash } from '../services/Resolution';
import { ValidateAndTransformOnDomainName } from '../middleware/inputValidators';

@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(RateLimiter(), ApiKeyAuthMiddleware)
export class DomainsController {
  @Get('/domains/:domainName')
  @UseBefore(
    AttachHeapTrackingMiddleware(HeapEvents.GET_DOMAIN),
    ValidateAndTransformOnDomainName('domainName'),
  )
  @ResponseSchema(DomainResponse)
  async getDomain(
    @Res() res: Response,
    @Param('domainName') domainName: string,
  ): Promise<DomainResponse> {
    const response = new DomainResponse();

    if (!isSupportedTLD(domainName.toLowerCase())) {
      response.meta.domain = domainName;
      return response;
    }

    domainName = domainName.toLowerCase();
    const domain = await Domain.findOne({
      where: { name: domainName },
      relations: ['resolutions', 'reverseResolutions'],
      cache: env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME,
    });

    if (domain) {
      const resolution = getDomainResolution(domain);
      response.meta = {
        domain: domain.name,
        tokenId: getTokenIdFromHash(domain.node),
        namehash: domain.node,
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

    response.meta.domain = domainName;
    return response;
  }

  @Get('/domains')
  @OpenAPI({
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DomainAttributes',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @UseBefore(ConvertArrayQueryParams('owners'))
  @UseBefore(ConvertArrayQueryParams('tlds'))
  @UseBefore(
    AttachHeapTrackingMiddleware(HeapEvents.GET_DOMAINS, [
      'resolution',
      'tlds',
      'owners',
      'sortBy',
      'sortDirection',
      'perPage',
      'startingAfter',
    ]),
  )
  async getDomainsList(
    @Res() res: Response,
    @QueryParams() query: DomainsListQuery,
  ): Promise<DomainsListResponse> {
    // Use raw query becaues typeorm doesn't seem to handle multiple nested relations (e.g. resolution.domain.parent.name)
    const where = [];
    if (query.tlds) {
      where.push({
        query: `"parent"."name" in (:...tlds)`,
        parameters: { tlds: query.tlds },
      });
    }

    if (query.resolution) {
      const resolutionKeys = Object.keys(query.resolution);
      for (let i = 0; i < resolutionKeys.length; i++) {
        const key = Object.keys(query.resolution)[i];
        where.push({
          query: `"resolution"."resolution"@>'{"${key}":"${query.resolution[key]}"}'::jsonb`,
        });
      }
    }

    let startingAfterId = undefined;
    const sortDirectionSign = query.sort.direction === 'ASC' ? '>' : '<';
    if (query.startingAfter.length !== 0) {
      const startingVals = query.startingAfter.split('|');
      if (startingVals.length !== query.sort.columns.length) {
        throw new Error('Invalid startingAfter value ' + query.startingAfter);
      }
      for (let i = 0; i < query.sort.columns.length; i++) {
        if (query.sort.columns[i] === 'domain.id') {
          startingAfterId = startingVals[i];
        }
        where.push({
          query: `${query.sort.columns[i]} ${sortDirectionSign} :startingAfter${i}`,
          parameters: { [`startingAfter${i}`]: startingVals[i] },
        });
      }
    }

    if (query.owners) {
      const ownersQuery = query.owners.map((owner) => owner.toLowerCase());
      where.push({
        query: `"resolution"."owner_address" in (:...owners)`,
        parameters: {
          owners: ownersQuery,
        },
      });
    }

    const qb = Domain.createQueryBuilder('domain');
    if (startingAfterId) {
      qb.leftJoinAndSelect(
        'domain.resolutions',
        'resolution',
        `resolution.domain ${sortDirectionSign} :resDomainId`,
        { resDomainId: startingAfterId },
      );
      qb.leftJoinAndSelect(
        'domain.reverseResolutions',
        'reverseResolutions',
        `reverseResolutions.domain ${sortDirectionSign} :reverseDomainId`,
        { reverseDomainId: startingAfterId },
      );
      qb.leftJoinAndSelect('domain.parent', 'parent');
    } else {
      qb.leftJoinAndSelect('domain.resolutions', 'resolution');
      qb.leftJoinAndSelect('domain.reverseResolutions', 'reverseResolutions');
      qb.leftJoinAndSelect('domain.parent', 'parent');
    }
    qb.where(`1 = 1`);

    // Filter domains with dead address owners from response
    const deadAddresses = DeadAdresses.map(
      (addr) => "'" + addr + "'",
    ).toString();
    if (!query.owners) {
      qb.where(`resolution.owner_address not in (${deadAddresses})`);
    }

    for (const q of where) {
      qb.andWhere(q.query, q.parameters);
    }
    for (const c of query.sort.columns) {
      qb.addOrderBy(c, query.sort.direction);
    }

    qb.take(query.perPage + 1);
    const domains = await qb
      .cache(env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME)
      .getMany();
    const hasMore = domains.length > query.perPage;
    if (hasMore) {
      domains.pop();
    }
    const lastDomain =
      domains.length !== 0 ? domains[domains.length - 1] : undefined;

    const response = new DomainsListResponse();
    response.data = [];
    res.locals.trackedResponseProperties = {};
    res.locals.trackedResponseProperties.response_domain_names = [];
    for (const domain of domains) {
      const resolution = getDomainResolution(domain);
      response.data.push({
        id: domain.name,
        attributes: {
          records: resolution.resolution,
          meta: {
            domain: domain.name,
            tokenId: getTokenIdFromHash(domain.node),
            namehash: domain.node,
            blockchain: resolution.blockchain,
            networkId: resolution.networkId,
            owner: resolution.ownerAddress,
            resolver: resolution.resolver,
            registry: resolution.registry,
            reverse: domain.hasReverseResolution,
          },
        },
      });
      res.locals.trackedResponseProperties.response_domain_names.push(
        domain.name,
      );
    }

    response.meta = {
      perPage: query.perPage,
      nextStartingAfter:
        query.nextStartingAfter(lastDomain) || query.startingAfter || '',
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      hasMore,
    };

    return response;
  }

  @Get('/domains/:domainName/transfers/latest')
  @OpenAPI({
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DomainLatestTransfer',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @UseBefore(
    AttachHeapTrackingMiddleware(HeapEvents.GET_LATEST_DOMAIN_TRANSFER),
    ValidateAndTransformOnDomainName('domainName'),
  )
  async getDomainsLastTransfer(
    @Res() res: Response,
    @Params() query: UnsDomainQuery,
  ): Promise<DomainLatestTransferResponse> {
    const supportedTLD = isSupportedTLD(query.domainName);

    if (!supportedTLD) {
      return {
        data: [],
      };
    }

    const tokenId = eip137Namehash(query.domainName);
    const domainEvents = await CnsRegistryEvent.createQueryBuilder();
    domainEvents.select();
    domainEvents.distinctOn(['blockchain']);
    domainEvents.where({
      node: tokenId,
      blockchain: In(['ETH', 'MATIC']),
      type: 'Transfer',
    });
    domainEvents.orderBy({
      blockchain: 'ASC',
      block_number: 'DESC',
      log_index: 'DESC',
    });
    const lastTransferEvents = await domainEvents.getMany();

    const response = new DomainLatestTransferResponse();
    response.data = lastTransferEvents.map((event) => {
      return {
        domain: query.domainName,
        from: event?.returnValues?.from,
        to: event?.returnValues?.to,
        networkId: event.networkId,
        blockNumber: event.blockNumber,
        blockchain: event.blockchain,
      };
    });

    return response;
  }

  @Get('/records')
  @OpenAPI({
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DomainRecords',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @UseBefore(
    AttachHeapTrackingMiddleware(HeapEvents.GET_DOMAIN_RECORDS, [
      'domains',
      'key',
    ]),
    ConvertArrayQueryParams('domains'),
  )
  async getDomainsRecords(
    @Res() res: Response,
    @QueryParams() query: DomainsRecordsQuery,
  ): Promise<DomainsRecordsResponse> {
    let domainNames = query.domains.map(normalizeDomainName);
    domainNames = domainNames.filter((domainName) => {
      return isSupportedTLD(domainName);
    });
    const tokens = domainNames.map(normalizeDomainOrToken);
    const domains = await Domain.findAllByNodes(
      tokens,
      Domain.getRepository(),
      true,
    );
    const zilTokens = domainNames
      .filter(
        (name) => IsZilDomain(name) && !domains.some((d) => d.name === name),
      )
      .map(znsNamehash);
    const zilDomains = await Domain.findAllByNodes(
      zilTokens,
      Domain.getRepository(),
      true,
    );
    const allDomains = domains.concat(zilDomains);
    const domainsRecords: DomainRecords[] = [];

    for (const domainName of domainNames) {
      const domain = allDomains.find((d) => d.name === domainName);

      if (domain) {
        const { resolution } = getDomainResolution(domain);
        const records = query.key ? pick(resolution, query.key) : resolution;
        domainsRecords.push({ domain: domainName, records });
      } else {
        domainsRecords.push({ domain: domainName, records: {} });
      }
    }

    return { data: domainsRecords };
  }
}
