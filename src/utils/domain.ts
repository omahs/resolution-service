import {
  AllDomainTlds,
  DeprecatedTld,
  DeprecatedTlds,
  SupportedTld,
  SupportedTlds,
} from '../types/common';
import { eip137Namehash } from './namehash';

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
