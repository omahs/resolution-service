import nodeFetch from 'node-fetch';
import { JsonController, Post, Body, UseBefore } from 'routing-controllers';
import { env } from '../env';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';

enum RpcNetwork {
  Polygon = 'matic',
  Ethereum = 'ethereum',
}
const handleRpcForward = async (
  network: RpcNetwork,
  body: { [key: string]: any },
): Promise<any> => {
  const providerUrl =
    network === RpcNetwork.Ethereum
      ? env.APPLICATION.ETHEREUM.JSON_RPC_API_URL
      : env.APPLICATION.POLYGON.JSON_RPC_API_URL;

  const response = await nodeFetch(providerUrl, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
};

@JsonController()
@UseBefore(ApiKeyAuthMiddleware)
export class RpcProxyController {
  @Post('/rpcproxy/l1')
  async proxyEth(
    @Body({ options: { limit: '1mb' } }) body: { [key: string]: any },
  ): Promise<any> {
    return handleRpcForward(RpcNetwork.Ethereum, body);
  }

  @Post('/rpcproxy/l2')
  async proxyPol(
    @Body({ options: { limit: '1mb' } }) body: { [key: string]: any },
  ): Promise<any> {
    return handleRpcForward(RpcNetwork.Polygon, body);
  }
}
