import { JsonController, Post, Body, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { RpcProviderError } from '../errors/HttpErrors';
import { RpcService, RpcPayload } from '../services/RpcService';
import { Blockchain } from '../types/common';
import RateLimiter from '../middleware/RateLimiter';
import { RpcResponse } from './dto/Rpc';

const MAX_PAYLOAD_SIZE = '1mb';
@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(RateLimiter(), ApiKeyAuthMiddleware)
export class RpcProxyController {
  private rpcService: RpcService;

  constructor() {
    this.rpcService = new RpcService(1000);
  }

  @Post('/chains/eth/rpc')
  @ResponseSchema(RpcResponse)
  async proxyEth(
    @Body({ options: { limit: MAX_PAYLOAD_SIZE } }) body: RpcPayload,
  ): Promise<RpcPayload> {
    try {
      const data = await this.rpcService.post(Blockchain.ETH, body);
      return data;
    } catch (e: any) {
      throw new RpcProviderError(e.message, 400);
    }
  }

  @Post('/chains/matic/rpc')
  @ResponseSchema(RpcResponse)
  async proxyPol(
    @Body({ options: { limit: MAX_PAYLOAD_SIZE } }) body: RpcPayload,
  ): Promise<RpcPayload> {
    try {
      const data = await this.rpcService.post(Blockchain.MATIC, body);
      return data;
    } catch (e: any) {
      throw new RpcProviderError(e.message, 400);
    }
  }
}
