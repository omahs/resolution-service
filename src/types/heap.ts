import { ParsedQs } from 'qs';

export enum HeapEvents {
  GET_DOMAIN = 'rsbe - get - domain',
  GET_DOMAINS = 'rsbe - get - domains list',
  GET_LATEST_DOMAIN_TRANSFER = 'rsbe - get - domain transfer',
  GET_DOMAIN_RECORDS = 'rsbe - get - domain records',
  GET_REVERSE = 'rsbe - get - reverse resolution',
  POST_BULK_REVERSE = 'rsbe - get - reverse resolution list',
  POST_RPC_PROXY = 'rsbe - post - onchain rpc proxy',
}

export interface HeapEventsProperties {
  [key: string]: number | undefined | string | string[] | ParsedQs | ParsedQs[];
  apiKey?: string;
  domainName?: string;
  tlds?: string;
  owners_address?: string;
  domain_names?: string;
  response_domain_names?: string;
  uri: string;
  responseCode: number;
}
