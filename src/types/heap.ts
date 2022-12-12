import { ParsedQs } from 'qs';

export enum HeapEvents {
  GET_DOMAIN = 'rsbe - get - domain',
  GET_DOMAINS = 'rsbe - get - domains list',
  GET_LATEST_DOMAIN_TRANSFER = 'rsbe - get - domain transfer',
  GET_DOMAIN_RECORDS = 'rsbe - get - domain records',
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
