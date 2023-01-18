import {
  Get,
  Post,
  JsonController,
  Param,
  Res,
  Body,
  UseBefore,
} from 'routing-controllers';
import { Response } from 'express';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { DomainResponse, DomainBaseResponse } from './dto/Domains';
import {
  BulkReverseQueryParams,
  BulkReverseQueryResponse,
} from './dto/Reverse';
import {
  getDomainResolution,
  getReverseResolution,
} from '../services/Resolution';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import RateLimiter from '../middleware/RateLimiter';
import { getTokenIdFromHash } from '../services/Resolution';
import { AttachHeapTrackingMiddleware } from '../middleware/SendHeapEvent';
import { HeapEvents } from '../types/heap';

@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(RateLimiter(), ApiKeyAuthMiddleware)
export class ReverseController {
  @Get('/reverse/:address')
  @UseBefore(
    AttachHeapTrackingMiddleware({ heapEventName: HeapEvents.GET_REVERSE }),
  )
  @ResponseSchema(DomainResponse)
  async getReverse(
    @Res() res: Response,
    @Param('address') address: string,
  ): Promise<DomainResponse> {
    const [reverse] = await getReverseResolution([address]);
    const response = new DomainResponse();
    if (reverse) {
      const domain = reverse.domain;
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
        reverse: true,
      };
      response.records = resolution.resolution;

      res.locals.trackedResponseProperties = {
        response_domain_name: domain.name,
      };
    }

    return response;
  }

  @Post('/reverse/query')
  @OpenAPI({
    summary: 'Get bulk reverse resolution',
  })
  @UseBefore(
    AttachHeapTrackingMiddleware({
      heapEventName: HeapEvents.POST_BULK_REVERSE,
      trackingRequestBody: ['addresses'],
    }),
  )
  @ResponseSchema(BulkReverseQueryResponse)
  async getReverses(
    @Res() res: Response,
    @Body() params: BulkReverseQueryParams,
  ): Promise<BulkReverseQueryResponse> {
    const { addresses } = params;

    const reverses = await getReverseResolution(addresses, {
      cache: true,
      withDomainResolutions: false,
    });

    res.locals.trackedResponseProperties = {
      response_domain_names: [],
    };

    const data = reverses.map(({ domain, reverseAddress }) => {
      const response = new DomainBaseResponse();
      response.meta = {
        domain: domain.name,
        tokenId: getTokenIdFromHash(domain.node),
        namehash: domain.node,
        owner: reverseAddress,
        reverse: true,
      };

      res.locals.trackedResponseProperties.response_domain_names.push(
        domain.name,
      );

      return response;
    });

    return { data };
  }
}
