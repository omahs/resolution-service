import { BigNumber } from 'ethers';
import {
  AllDomainTlds,
  DeprecatedTld,
  DeprecatedTlds,
  SupportedTld,
  SupportedTlds,
} from '../types/common';
import { eip137Namehash } from './namehash';

const VALID_DOMAIN_LABEL_REGEX = /^[a-zA-Z\d]([a-zA-Z\d-]{1,252})?$/;
const VALID_TOKEN_REGEX = /^[a-fA-F0-9]+$/;

export const isValidDomainNameLabel = (domainName: string): boolean => {
  return VALID_DOMAIN_LABEL_REGEX.test(domainName.split('.')[0]);
};

export const isValidToken = (token: string): boolean => {
  return VALID_TOKEN_REGEX.test(token.replace('0x', ''));
};

export function IsZilDomain(name: string): boolean {
  const tokens = name.split('.');
  const tld = tokens[tokens.length - 1];
  return tld === 'zil';
}

const normalizeToken = (token: string): string => {
  return '0x' + BigInt(token).toString(16).padStart(64, '0');
};

export const normalizeDomainName = (domainName: string): string => {
  return domainName.trim().toLowerCase();
};

export const getDomainNameTld = (domainName: string): string => {
  return domainName.split('.').pop() ?? '';
};

export const getDomainNameLabel = (domainName: string): string => {
  return normalizeDomainName(domainName).split('.').shift() ?? '';
};

export const normalizeDomainOrToken = (domainOrToken: string): string => {
  const domainName = normalizeDomainName(domainOrToken);

  if (domainName.includes('.')) {
    return eip137Namehash(domainName);
  } else if (domainName.replace('0x', '').match(/^[a-fA-F0-9]+$/)) {
    return normalizeToken(domainName);
  }

  return domainName;
};

export const isSupportedTLD = (domainName: string): boolean => {
  const tld = getDomainNameTld(domainName);
  return SupportedTlds.includes(tld as SupportedTld);
};

export const isDeprecatedTLD = (domainName: string): boolean => {
  const tld = getDomainNameTld(domainName);
  return DeprecatedTlds.includes(tld as DeprecatedTld);
};

export const splitDomain = (
  domain: string,
): { label: string; extension: AllDomainTlds } => {
  const splitted = domain.split('.');
  const extension = splitted.pop()!;

  const label = splitted.join('.');
  return { label, extension: extension as AllDomainTlds };
};

export const belongsToTld = (
  domain: string,
  domainSuffix: AllDomainTlds,
): boolean => {
  const { extension } = splitDomain(domain);
  return domainSuffix === extension;
};

export const tokenIdToNode = (tokenId: BigNumber): string => {
  const node = tokenId.toHexString().replace(/^(0x)?/, '');
  return '0x' + node.padStart(64, '0');
};
