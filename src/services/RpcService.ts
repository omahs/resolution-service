import nodeFetch from 'node-fetch';

import { env } from '../env';

import { Blockchain } from '../types/common';

export type RpcPayload = { [key: string]: any };

export class RpcService {
  private ethRpcUrl: string = env.APPLICATION.ETHEREUM.JSON_RPC_API_URL;
  private polygonRpcUrl: string = env.APPLICATION.POLYGON.JSON_RPC_API_URL;
  private requestTimeout: number;

  constructor(requestTimeout: number /* range 0 to 5s */) {
    if (requestTimeout <= 0 || requestTimeout > 5000) {
      throw new Error('Invalid timeout');
    }

    this.requestTimeout = requestTimeout;
  }

  public async post(
    blockchain: Blockchain,
    body: RpcPayload,
  ): Promise<RpcPayload> {
    let rpcUrl: string;

    switch (blockchain) {
      case Blockchain.ETH:
        rpcUrl = this.ethRpcUrl;
        break;
      case Blockchain.MATIC:
        rpcUrl = this.polygonRpcUrl;
        break;
      default:
        throw new Error(`Unsupported blockchain ${blockchain}`);
    }

    try {
      const response = await nodeFetch(rpcUrl, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        timeout: this.requestTimeout,
      });

      return await response.json();
    } catch (error: any) {
      if (error.name === 'FetchError') {
        // native node-fetch error
        // DO NOT forward node-fetch error to expose RPC provider to responses
        throw new Error(error.type);
      }

      throw error;
    }
  }
}
