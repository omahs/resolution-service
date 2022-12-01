import { normalizeHeapPropParam } from './heap';
import { expect } from 'chai';
import { env } from '../env';
import sinon from 'sinon';
import { logger } from '../logger';

describe('Heap Utils', () => {
  describe('normalizeHeapPropParam()', () => {
    const stringWithLength1024 =
      'ixzwOhFbovhLURAHB3kbSVDNLSRabN3lne0bBLCa3sPDKvTngCesbBvQTbclRbV7YRcDcfG4qJfbyS8JCcvKpIVwppSgLFtZKEjyr5g5eEjIaziUQSsnJAK1HCsiZVBq7hcbNLWXJ9Q4n5lEZi8tJNYwMs9Ov9k968YvfeT0GCqr3TvgNZJ6lcMAFYJLEQFzCQwv1REMx9uOEN5Z9YB5APMOZ1DIDMZuami6t92iml3LaRuFOhK4cdRp6M8rQHRzNlTJ7XRObSRqXPU4AX7uE4l7rxdoRednm1UBqtQl6LRhPJnEYjTNcGJVWciHfYugYeIpQ483qTZp5IsLVQYaEWhu4tMeGVUNMV6h27Yk7g7CMX3blq4v7p70kHWkvFlKa4jcBb7xW6SsUglVEqWF4BFu1OS49PcMHICTz9ZBk7FQiBSVHx7kN3ZDre4Z5Qf2xPzEifMEqTEC1tnnsMfzVj6TtI9vHEF1sQVFurtYPF2Coi4r6414WbdjOmKMEV656BczLuy4uKDXGEtPweox2TAry0TkYoVc3zttXQ1F0pkROfxO0NGUJOy0YgdRZyrYJpsVHULMwxMSZvLZl7iN8mGfBr1w6KW0o6pJLynXleN2DOpuHLuxAuOBh18cQevsA209QBNRJVSPV8cbGdk0g2quHCXWPaTtShl2Nxecj6d8INLWi8CQPwfCBjyLt4Q83t2H2BM4rR5R7E1pYroNVbosX0E53Iaoop1DeimkeI62XwwyPSV1I7jNxui3dKnRCFuXPgN8XmJneDsrtLeWDV5eHkg4dnHQUElc2FHaikvFa5DkV2seyEXadBGbjPTKkWMguGVpbntNR4edJve6mfInwibqxbqT44xR9gU6xRcvANfnqPcHG0w55cv3sGp6vwsD8JUsWXMz6uAVPtqXb4Gl5uEoOz9m3NDriR2nMHWY91IoiSXTq8AdjNYVV4cOB3RXYNtdwkmXyrsmADQsuYw9fO3mQQ4M34PsW62eIW1sEuccZQ3GCR663juP0zLo';
    const stringWithLength1022 =
      'ixzwOhFbovhLURAHB3kbSVDNLSRabN3lne0bBLCa3sPDKvTngCesbBvQTbclRbV7YRcDcfG4qJfbyS8JCcvKpIVwppSgLFtZKEjyr5g5eEjIaziUQSsnJAK1HCsiZVBq7hcbNLWXJ9Q4n5lEZi8tJNYwMs9Ov9k968YvfeT0GCqr3TvgNZJ6lcMAFYJLEQFzCQwv1REMx9uOEN5Z9YB5APMOZ1DIDMZuami6t92iml3LaRuFOhK4cdRp6M8rQHRzNlTJ7XRObSRqXPU4AX7uE4l7rxdoRednm1UBqtQl6LRhPJnEYjTNcGJVWciHfYugYeIpQ483qTZp5IsLVQYaEWhu4tMeGVUNMV6h27Yk7g7CMX3blq4v7p70kHWkvFlKa4jcBb7xW6SsUglVEqWF4BFu1OS49PcMHICTz9ZBk7FQiBSVHx7kN3ZDre4Z5Qf2xPzEifMEqTEC1tnnsMfzVj6TtI9vHEF1sQVFurtYPF2Coi4r6414WbdjOmKMEV656BczLuy4uKDXGEtPweox2TAry0TkYoVc3zttXQ1F0pkROfxO0NGUJOy0YgdRZyrYJpsVHULMwxMSZvLZl7iN8mGfBr1w6KW0o6pJLynXleN2DOpuHLuxAuOBh18cQevsA209QBNRJVSPV8cbGdk0g2quHCXWPaTtShl2Nxecj6d8INLWi8CQPwfCBjyLt4Q83t2H2BM4rR5R7E1pYroNVbosX0E53Iaoop1DeimkeI62XwwyPSV1I7jNxui3dKnRCFuXPgN8XmJneDsrtLeWDV5eHkg4dnHQUElc2FHaikvFa5DkV2seyEXadBGbjPTKkWMguGVpbntNR4edJve6mfInwibqxbqT44xR9gU6xRcvANfnqPcHG0w55cv3sGp6vwsD8JUsWXMz6uAVPtqXb4Gl5uEoOz9m3NDriR2nMHWY91IoiSXTq8AdjNYVV4cOB3RXYNtdwkmXyrsmADQsuYw9fO3mQQ4M34PsW62eIW1sEuccZQ3GCR663juP0z';
    const stringWithLength1025 =
      'ixzwOhFbovhLURAHB3kbSVDNLSRabN3lne0bBLCa3sPDKvTngCesbBvQTbclRbV7YRcDcfG4qJfbyS8JCcvKpIVwppSgLFtZKEjyr5g5eEjIaziUQSsnJAK1HCsiZVBq7hcbNLWXJ9Q4n5lEZi8tJNYwMs9Ov9k968YvfeT0GCqr3TvgNZJ6lcMAFYJLEQFzCQwv1REMx9uOEN5Z9YB5APMOZ1DIDMZuami6t92iml3LaRuFOhK4cdRp6M8rQHRzNlTJ7XRObSRqXPU4AX7uE4l7rxdoRednm1UBqtQl6LRhPJnEYjTNcGJVWciHfYugYeIpQ483qTZp5IsLVQYaEWhu4tMeGVUNMV6h27Yk7g7CMX3blq4v7p70kHWkvFlKa4jcBb7xW6SsUglVEqWF4BFu1OS49PcMHICTz9ZBk7FQiBSVHx7kN3ZDre4Z5Qf2xPzEifMEqTEC1tnnsMfzVj6TtI9vHEF1sQVFurtYPF2Coi4r6414WbdjOmKMEV656BczLuy4uKDXGEtPweox2TAry0TkYoVc3zttXQ1F0pkROfxO0NGUJOy0YgdRZyrYJpsVHULMwxMSZvLZl7iN8mGfBr1w6KW0o6pJLynXleN2DOpuHLuxAuOBh18cQevsA209QBNRJVSPV8cbGdk0g2quHCXWPaTtShl2Nxecj6d8INLWi8CQPwfCBjyLt4Q83t2H2BM4rR5R7E1pYroNVbosX0E53Iaoop1DeimkeI62XwwyPSV1I7jNxui3dKnRCFuXPgN8XmJneDsrtLeWDV5eHkg4dnHQUElc2FHaikvFa5DkV2seyEXadBGbjPTKkWMguGVpbntNR4edJve6mfInwibqxbqT44xR9gU6xRcvANfnqPcHG0w55cv3sGp6vwsD8JUsWXMz6uAVPtqXb4Gl5uEoOz9m3NDriR2nMHWY91IoiSXTq8AdjNYVV4cOB3RXYNtdwkmXyrsmADQsuYw9fO3mQQ4M34PsW62eIW1sEuccZQ3GCR663juP0zLoD';
    it('should be able to truncate and log properties when greater than max', () => {
      const loggerSpy = sinon.spy(logger, 'info');
      const propertyValues = ['testing', stringWithLength1024, 'test'];
      const propParam = normalizeHeapPropParam(propertyValues, 'test');

      expect(propParam.length).to.be.lessThanOrEqual(
        env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT,
      );
      expect(propParam).to.be.equal('testing,...');
      expect(loggerSpy).to.be.calledWith(
        `Heap property (test) has reached the max character length: ${propertyValues}`,
      );
      loggerSpy.restore();
    });

    it('should not have to truncate if property characters were not reached', () => {
      const propertyValues = ['testing', 'test'];
      const propParam = normalizeHeapPropParam(propertyValues, 'test');

      expect(propParam.length).to.be.lessThanOrEqual(
        env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT,
      );
      expect(propParam).to.be.equal('testing,test');
    });

    it("should remove the last property and include ',...' when adding passes max", () => {
      const loggerSpy = sinon.spy(logger, 'info');
      let propertyValues = [stringWithLength1022, 'testing', 'test'];
      let propParam = normalizeHeapPropParam(propertyValues, 'test');
      expect(propParam).to.be.equal('...,');
      expect(loggerSpy).to.be.calledWith(
        `Heap property (test) has reached the max character length: ${propertyValues}`,
      );
      // loggerSpy.restore();
      propertyValues = ['testing', stringWithLength1022, 'test'];
      propParam = normalizeHeapPropParam(propertyValues, 'test');
      expect(propParam).to.be.equal('testing,...');
      expect(loggerSpy).to.be.calledWith(
        `Heap property (test) has reached the max character length: ${propertyValues}`,
      );
    });

    it('should return ..., if length of first property value exceeds max', () => {
      const propParam = normalizeHeapPropParam([stringWithLength1025], 'test');
      expect(propParam).to.be.equal(`...,`);
    });
  });
});
