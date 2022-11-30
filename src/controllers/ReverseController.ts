import {
  Get,
  Post,
  JsonController,
  Param,
  Body,
  UseBefore,
} from 'routing-controllers';
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

@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(RateLimiter(), ApiKeyAuthMiddleware)
export class ReverseController {
  @Get('/reverse/:address')
  @ResponseSchema(DomainResponse)
  async getReverse(@Param('address') address: string): Promise<DomainResponse> {
    const [reverse] = await getReverseResolution([address]);
    const response = new DomainResponse();
    if (reverse) {
      const domain = reverse.domain;
      const resolution = getDomainResolution(domain);
      response.meta = {
        domain: domain.name,
        blockchain: resolution.blockchain,
        networkId: resolution.networkId,
        owner: resolution.ownerAddress,
        resolver: resolution.resolver,
        registry: resolution.registry,
        reverse: true,
      };
      response.records = resolution.resolution;
    }

    return response;
  }

  @Post('/reverse/query')
  @ResponseSchema(BulkReverseQueryResponse)
  async getReverses(
    @Body() params: BulkReverseQueryParams,
  ): Promise<BulkReverseQueryResponse> {
    const { addresses } = params;

    const reverses = await getReverseResolution(addresses, {
      cache: true,
      withDomainResolutions: false,
    });

    const data = reverses.map(({ domain, reverseAddress }) => {
      const response = new DomainBaseResponse();
      response.meta = {
        domain: domain.name,
        owner: reverseAddress,
        reverse: true,
      };

      return response;
    });

    return { data };
  }
}
