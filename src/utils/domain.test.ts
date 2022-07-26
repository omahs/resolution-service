import { expect } from 'chai';
import { normalizeDomainOrToken } from './domain';
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
});
