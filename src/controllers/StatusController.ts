import {
  Get,
  Head,
  JsonController,
  Redirect,
  UseBefore,
} from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Domain, WorkerStatus } from '../models';
import { env } from '../env';
import { Blockchain, SupportedTld, SupportedTlds } from '../types/common';
import RateLimiter from '../middleware/RateLimiter';

class BlockchainStatus {
  @IsBoolean()
  isUpToDate: boolean;

  @IsNumber()
  lastUpdated = 0;

  @IsNumber()
  latestMirroredBlock = 0;

  @IsNumber()
  networkId: number;
}

class Blockchains {
  @ValidateNested()
  ETH: BlockchainStatus;

  @ValidateNested()
  MATIC: BlockchainStatus;

  @ValidateNested()
  ZIL: BlockchainStatus;
}

class StatusResponse {
  @ValidateNested()
  blockchain: Blockchains;
}

@JsonController()
@UseBefore(RateLimiter())
export class StatusController {
  private static async blockchainStatusForNetwork(
    blockchain: Blockchain,
    config: {
      NETWORK_ID: number;
      ACCEPTABLE_DELAY_TIME_MS: number;
    },
  ): Promise<BlockchainStatus> {
    const latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      blockchain,
    );
    const workerStatus = await WorkerStatus.findOne({ location: blockchain });
    const lastUpdated = workerStatus?.updatedAt?.getTime() || 0;
    const currentTime = new Date().getTime();

    const status: BlockchainStatus = {
      latestMirroredBlock,
      lastUpdated,
      networkId: config.NETWORK_ID,
      isUpToDate: false,
    };
    status.isUpToDate =
      currentTime - status.lastUpdated <= config.ACCEPTABLE_DELAY_TIME_MS;
    return status;
  }

  @Head('/')
  headRoot() {
    // Avoids redirects to /api-docs
  }

  @Get('/')
  @Redirect('/api-docs')
  getRoot() {
    // Redirects to /api-docs
  }

  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    const blockchain = new Blockchains();
    blockchain.ETH = await StatusController.blockchainStatusForNetwork(
      Blockchain.ETH,
      env.APPLICATION.ETHEREUM,
    );
    blockchain.MATIC = await StatusController.blockchainStatusForNetwork(
      Blockchain.MATIC,
      env.APPLICATION.POLYGON,
    );
    blockchain.ZIL = await StatusController.blockchainStatusForNetwork(
      Blockchain.ZIL,
      env.APPLICATION.ZILLIQA,
    );

    statusResponse.blockchain = blockchain;
    return statusResponse;
  }

  @Get('/liveness_check')
  async livenessCheck(): Promise<{ status: string }> {
    await Domain.findOne();
    return { status: 'ok' };
  }

  @Get('/readiness_check')
  async readinessCheck(): Promise<{ status: string }> {
    await Domain.findOne();
    return { status: 'ok' };
  }

  @Get('/supported_tlds')
  listSupportedTlds(): { tlds: Array<SupportedTld> } {
    return {
      tlds: SupportedTlds,
    };
  }
}
