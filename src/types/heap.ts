export enum HeapEvents {
  GET_DOMAIN = 'rsbe - get - domain',
  GET_DOMAINS = 'rsbe - get - domains list',
  GET_LATEST_DOMAIN_TRANSFER = 'rsbe - get - domain transfer',
  GET_DOMAIN_RECORDS = 'rsbe - get - domain records',
}

export interface HeapEventsProperties {
  apiKey?: string;
  domainName?: string;
  uri: string;
}
