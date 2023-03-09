import { expect } from 'chai';
import { UnstoppableDomainTlds } from '../types/common';
import {
  belongsToTld,
  isSupportedTLD,
  normalizeDomainOrToken,
  splitDomain,
} from './domain';
import { eip137Namehash } from './namehash';

describe('utils/domain', () => {
  describe('normalizeDomainOrToken', () => {
    it('trims spaces and converts a domain name into an eip137 hash', () => {
      const domainName = ' Heyo.crypto   ';
      expect(normalizeDomainOrToken(domainName)).to.eq(
        eip137Namehash(domainName.trim().toLowerCase()),
      );
    });

    it('normalizes token ID', () => {
      const tokenId =
        '6304531997610998161237844647282663196661123000121147597890468333969432655810';
      expect(normalizeDomainOrToken(tokenId)).to.eq(
        eip137Namehash('uns-devtest-265f8f.wallet'),
      );
    });

    it('normalizes node', () => {
      const node =
        '0x0df03d18a0a02673661da22d06f43801a986840e5812989139f0f7a2c41037c2';
      expect(normalizeDomainOrToken(node)).to.eq(
        eip137Namehash('uns-devtest-265f8f.wallet'),
      );
    });

    it('does not normalize gibberish', () => {
      const gibberish = '@@@@@@@@@@@';
      expect(gibberish).to.eq(gibberish);
    });
  });

  describe('splitDomain', () => {
    it('splits properly for all (unstoppable + external) domains', () => {
      const tests = [
        {
          domain: 'foo.crypto',
          extension: 'crypto',
          label: 'foo',
        },
        {
          domain: 'foo.bar.crypto',
          extension: 'crypto',
          label: 'foo.bar',
        },
        {
          domain: 'bar.zil',
          extension: 'zil',
          label: 'bar',
        },
      ];

      for (const test of tests) {
        const { extension, label } = splitDomain(test.domain);
        expect(extension).to.eq(test.extension);
        expect(label).to.eq(test.label);
      }
    });
  });

  describe('belongsToTld', () => {
    it('returns true', () => {
      expect(belongsToTld('foo.crypto', UnstoppableDomainTlds.Crypto)).to.be
        .true;
      expect(belongsToTld('foo.CrYpTo', UnstoppableDomainTlds.Crypto)).to.be
        .true;
      expect(belongsToTld('foo.zil', UnstoppableDomainTlds.Zil)).to.be.true;
    });

    it('returns false', () => {
      expect(belongsToTld('foo.crypto', UnstoppableDomainTlds.Zil)).to.be.false;
      expect(belongsToTld('', UnstoppableDomainTlds.Zil)).to.be.false;
      expect(belongsToTld('', UnstoppableDomainTlds.Crypto)).to.be.false;
      expect(belongsToTld('foo.zil', UnstoppableDomainTlds.Crypto)).to.be.false;
    });
  });

  describe('isSupportedTLD', () => {
    it('returns true', () => {
      expect(isSupportedTLD('foo.crypto')).to.be.true;
      expect(isSupportedTLD('foo.NFT')).to.be.true;
      expect(isSupportedTLD('foo.CrYpTo')).to.be.true;
      expect(isSupportedTLD('foo.zil')).to.be.true;
    });

    it('returns false', () => {
      expect(isSupportedTLD('whatever')).to.be.false;
      expect(isSupportedTLD('foo.invalid')).to.be.false;
      expect(isSupportedTLD('')).to.be.false;
    });
  });
});
