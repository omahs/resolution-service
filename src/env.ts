import * as path from 'path';
import { Blockchain } from './types/common';

const requiredEnvNotSet = [];

if (!process.env.RESOLUTION_POSTGRES_HOST) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_HOST');
}
if (!process.env.RESOLUTION_POSTGRES_USERNAME) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_USERNAME');
}
if (
  !process.env.RESOLUTION_POSTGRES_PASSWORD &&
  process.env.RESOLUTION_POSTGRES_PASSWORD != ''
) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_PASSWORD');
}
if (!process.env.RESOLUTION_POSTGRES_DATABASE) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_DATABASE');
}
if (!process.env.VIEWBLOCK_API_KEY) {
  requiredEnvNotSet.push('VIEWBLOCK_API_KEY');
}
if (!process.env.ETHEREUM_JSON_RPC_API_URL) {
  requiredEnvNotSet.push('ETHEREUM_JSON_RPC_API_URL');
}
if (!process.env.POLYGON_JSON_RPC_API_URL) {
  requiredEnvNotSet.push('POLYGON_JSON_RPC_API_URL');
}

if (requiredEnvNotSet.length !== 0) {
  throw new Error(
    `Environment variables are not defined: ${requiredEnvNotSet.join(' && ')}`,
  );
}

const ZnsNetwork = process.env.ZNS_NETWORK || 'mainnet';

function parseNumberFromEnv(envVar: string | undefined, defaultVal: number) {
  return !isNaN(Number(envVar)) ? Number(envVar) : defaultVal;
}

function parseBooleanFromEnv(
  envVar: string | undefined,
  defaultVal: boolean,
): boolean {
  const envVarLowerCase = envVar?.toLowerCase();
  if (envVarLowerCase === 'true' || envVarLowerCase === 'false') {
    return envVarLowerCase === 'true';
  }

  return defaultVal;
}

export type EthUpdaterConfig = {
  CNS_REGISTRY_EVENTS_STARTING_BLOCK: number;
  UNS_REGISTRY_EVENTS_STARTING_BLOCK: number;
  JSON_RPC_API_URL: string;
  NETWORK_ID: number;
  CONFIRMATION_BLOCKS: number;
  BLOCK_FETCH_LIMIT: number;
  CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK: number;
  RECORDS_PER_PAGE: number;
  FETCH_INTERVAL: number;
  MAX_REORG_SIZE: number;
  ACCEPTABLE_DELAY_IN_BLOCKS: number;
  RESYNC_FROM: number | undefined;
};

type RunningMode =
  | 'MIGRATIONS'
  | 'API'
  | 'SERVICE_API'
  | 'METADATA_API'
  | 'ETH_WORKER'
  | 'MATIC_WORKER'
  | 'ZIL_WORKER';

export const blockchainRunningModes: Record<Blockchain, RunningMode> = {
  [Blockchain.ETH]: 'ETH_WORKER',
  [Blockchain.MATIC]: 'MATIC_WORKER',
  [Blockchain.ZIL]: 'ZIL_WORKER',
};

export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || process.env.PORT || 3000,
    RUNNING_MODE: (process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : [
          'MIGRATIONS',
          'API',
          'ETH_WORKER',
          'MATIC_WORKER',
          'ZIL_WORKER',
        ]) as RunningMode[],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: parseNumberFromEnv(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK,
        9080000,
      ),
      UNS_REGISTRY_EVENTS_STARTING_BLOCK: parseNumberFromEnv(
        process.env.UNS_REGISTRY_EVENTS_STARTING_BLOCK,
        12779230,
      ),
      JSON_RPC_API_URL: process.env.ETHEREUM_JSON_RPC_API_URL,
      NETWORK_ID: parseNumberFromEnv(process.env.ETHEREUM_NETWORK_ID, 1),
      CONFIRMATION_BLOCKS: parseNumberFromEnv(
        process.env.ETHEREUM_CONFIRMATION_BLOCKS,
        20,
      ),
      BLOCK_FETCH_LIMIT: parseNumberFromEnv(
        process.env.ETHEREUM_BLOCK_FETCH_LIMIT,
        500,
      ),
      CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK: parseNumberFromEnv(
        process.env.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK,
        9080000,
      ),
      RECORDS_PER_PAGE: parseNumberFromEnv(
        process.env.ETHEREUM_RECORDS_PER_PAGE,
        100,
      ),
      FETCH_INTERVAL: parseNumberFromEnv(
        process.env.ETHEREUM_FETCH_INTERVAL,
        5000,
      ),
      MAX_REORG_SIZE: parseNumberFromEnv(
        process.env.ETHEREUM_MAX_REORG_SIZE,
        200,
      ),
      ACCEPTABLE_DELAY_IN_BLOCKS: parseNumberFromEnv(
        process.env.ETHEREUM_ACCEPTABLE_DELAY_IN_BLOCKS,
        100,
      ),
      RESYNC_FROM: !isNaN(Number(process.env.ETHEREUM_RESYNC_FROM))
        ? Number(process.env.ETHEREUM_RESYNC_FROM)
        : undefined,
    } as EthUpdaterConfig,
    POLYGON: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: parseNumberFromEnv(
        process.env.POLYGON_CNS_REGISTRY_EVENTS_STARTING_BLOCK,
        19345077,
      ),
      UNS_REGISTRY_EVENTS_STARTING_BLOCK: parseNumberFromEnv(
        process.env.POLYGON_UNS_REGISTRY_EVENTS_STARTING_BLOCK,
        19345077,
      ),
      JSON_RPC_API_URL: process.env.POLYGON_JSON_RPC_API_URL,
      NETWORK_ID: parseNumberFromEnv(process.env.POLYGON_NETWORK_ID, 137),
      CONFIRMATION_BLOCKS: parseNumberFromEnv(
        process.env.POLYGON_CONFIRMATION_BLOCKS,
        20,
      ),
      BLOCK_FETCH_LIMIT: parseNumberFromEnv(
        process.env.POLYGON_BLOCK_FETCH_LIMIT,
        500,
      ),
      CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK: parseNumberFromEnv(
        process.env.POLYGON_CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK,
        19345077,
      ),
      RECORDS_PER_PAGE: parseNumberFromEnv(
        process.env.POLYGON_RECORDS_PER_PAGE,
        100,
      ),
      FETCH_INTERVAL: parseNumberFromEnv(
        process.env.POLYGON_FETCH_INTERVAL,
        5000,
      ),
      MAX_REORG_SIZE: parseNumberFromEnv(
        process.env.POLYGON_MAX_REORG_SIZE,
        200,
      ),
      ACCEPTABLE_DELAY_IN_BLOCKS: parseNumberFromEnv(
        process.env.POLYGON_ACCEPTABLE_DELAY_IN_BLOCKS,
        100,
      ),
      RESYNC_FROM: !isNaN(Number(process.env.POLYGON_RESYNC_FROM))
        ? Number(process.env.POLYGON_RESYNC_FROM)
        : undefined,
    } as EthUpdaterConfig,
    ZILLIQA: {
      NETWORK: ZnsNetwork,
      NETWORK_ID: Number(ZnsNetwork === 'mainnet' ? 1 : 333),
      ZNS_REGISTRY_CONTRACT:
        ZnsNetwork === 'mainnet'
          ? '0x9611c53be6d1b32058b2747bdececed7e1216793'
          : '0xB925adD1d5EaF13f40efD43451bF97A22aB3d727',
      JSON_RPC_API_URL:
        ZnsNetwork === 'mainnet'
          ? 'https://api.zilliqa.com/'
          : 'https://dev-api.zilliqa.com/',
      VIEWBLOCK_API_KEY: process.env.VIEWBLOCK_API_KEY,
      VIEWBLOCK_API_URL: 'https://api.viewblock.io/v1/zilliqa',
      FETCH_INTERVAL: parseNumberFromEnv(process.env.ZNS_FETCH_INTERVAL, 5000),
      ACCEPTABLE_DELAY_IN_BLOCKS: parseNumberFromEnv(
        process.env.ZILLIQA_ACCEPTABLE_DELAY_IN_BLOCKS,
        20,
      ),
      CONFIRMATION_BLOCKS: parseNumberFromEnv(
        process.env.ZILLIQA_CONFIRMATION_BLOCKS,
        0,
      ),
      RESYNC_FROM: !isNaN(Number(process.env.ZILLIQA_RESYNC_FROM))
        ? Number(process.env.ZILLIQA_RESYNC_FROM)
        : undefined,
    },
    ERC721_METADATA: {
      GOOGLE_CLOUD_STORAGE_BASE_URL:
        'https://storage.googleapis.com/dot-crypto-metadata-api',
    },
    NEW_RELIC_LICENSE_KEY: process.env.NEW_RELIC_LICENSE_KEY || '',
    NEW_RELIC_APP_NAME: process.env.NEW_RELIC_APP_NAME || '',
    BUGSNAG_API_KEY: process.env.BUGSNAG_API_KEY || '',
    DATADOG_APM_ENABLE: parseBooleanFromEnv(
      process.env.DATADOG_APM_ENABLE,
      false,
    ),
    DATADOG_APM_SERVICE_NAME:
      process.env.DATADOG_APM_SERVICE_NAME || 'resolution-service-staging',
    DATADOG_AGENT_HOSTNAME: process.env.DATADOG_AGENT_HOSTNAME || 'localhost',
    DD_AGENT_HOST: process.env.DD_AGENT_HOST || 'localhost',
    APP_AUTH_KEY: process.env.RESOLUTION_APP_AUTH_KEY || '',
    RATE_LIMITER: {
      RATE_LIMITER_DISABLED: parseBooleanFromEnv(
        process.env.RATE_LIMITER_DISABLED,
        false,
      ),
      DEFAULT_MAX_REQUESTS: parseNumberFromEnv(
        process.env.RATE_LIMITER_DEFAULT_MAX_REQUESTS,
        5,
      ),
      METADATA_MAX_REQUESTS: parseNumberFromEnv(
        process.env.RATE_LIMITER_METADATA_MAX_REQUESTS,
        10,
      ),
      WINDOW_MS: parseNumberFromEnv(process.env.RATE_LIMITER_WINDOW_MS, 1000),
    },
    HEAP: {
      URI: 'https://heapanalytics.com/api/track',
      APP_ID: process.env.HEAP_APP_ID,
      PUBLIC_IDENTITY: 'public',
      PROP_MAX_CHARACTER_LIMIT: 1024,
    },
  },
  TYPEORM: {
    LOGGING: {
      colorize: parseBooleanFromEnv(process.env.TYPEORM_LOGGING_COLORIZE, true),
    },
    type: 'postgres' as const,
    host: process.env.RESOLUTION_POSTGRES_HOST,
    username: process.env.RESOLUTION_POSTGRES_USERNAME,
    password: process.env.RESOLUTION_POSTGRES_PASSWORD,
    database: process.env.RESOLUTION_POSTGRES_DATABASE,
    ssl: process.env.RESOLUTION_POSTGRES_SSL
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
    port: parseNumberFromEnv(process.env.RESOLUTION_POSTGRES_PORT, 5432),
    entities: [
      path.join(__dirname, './models/index.ts'),
      path.join(__dirname, './models/index.js'),
    ] as string[],
    migrations: [
      path.join(__dirname, './database/migrations/*.ts'),
      path.join(__dirname, './database/migrations/*.js'),
    ] as string[],
    SNAPSHOT: {
      cnsEventsCount: parseNumberFromEnv(
        process.env.SNAPSHOT_CNS_EVENTS_COUNT,
        966679,
      ),
      znsTransactionsCount: parseNumberFromEnv(
        process.env.SNAPSHOT_ZNS_TRANSACTIONS_COUNT,
        95203,
      ),
      domainsCount: parseNumberFromEnv(
        process.env.SNAPSHOT_DOMAINS_COUNT,
        269650,
      ),
    },
  },
  CACHE: {
    IN_MEMORY_CACHE_EXPIRATION_TIME: parseNumberFromEnv(
      process.env.IN_MEMORY_CACHE_EXPIRATION_TIME,
      600000, // 10 minutes
    ),
    IN_MEMORY_CACHE_DISABLED: parseBooleanFromEnv(
      process.env.IN_MEMORY_CACHE_DISABLED,
      false,
    ),
  },
  MORALIS: {
    API_URL: process.env.MORALIS_API_URL,
    APP_ID: process.env.MORALIS_APP_ID,
  },
  OPENSEA: {
    API_KEY: process.env.OPENSEA_API_KEY,
  },
  CLOUD_STORAGE: {
    CLIENT_ASSETS: {
      BUCKET_ID:
        process.env.CLOUD_STORAGE_BUCKET_ID || 'resolution-client-assets',
    },
    API_ENDPOINT_URL: process.env.CLOUD_STORAGE_ENDPONT_URL, // default is https://storage.googleapis.com/
  },
  PROFILE_API_URL: process.env.PROFILE_API_URL,
  TEST: {
    INTEGRATION: parseBooleanFromEnv(process.env.RUN_INTEGRATION_TESTS, false),
  },
};
