import { expect } from 'chai';
import sinon from 'sinon';
import {
  ValidateAndTransformOnDomainNameOrToken,
  ValidateAndTransformOnDomainName,
} from './inputValidators';
import { Response, Request } from 'express';

describe('InputValidatorMiddleware', () => {
  const sandbox = sinon.createSandbox();

  let mockRequest: Request;
  const mockResponse: Response = {} as Response;
  let next: sinon.SinonSpy;

  beforeEach(() => {
    next = sandbox.fake();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('ValidateAndTransformOnDomainNameOrToken', () => {
    const middleware = ValidateAndTransformOnDomainNameOrToken('domainOrToken');

    it('should pass for input valid domain name', () => {
      mockRequest = {
        params: {
          domainOrToken: 'abcde.crypto',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(next.calledOnce);
    });

    it('should pass trim input', () => {
      mockRequest = {
        params: {
          domainOrToken: '   abcde.crypto',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(mockRequest.params.domainOrToken).to.eql('abcde.crypto');

      expect(next.calledOnce);
    });

    it('should pass for valid TLDs', () => {
      mockRequest = {
        params: {
          domainOrToken: 'crypto',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(next.calledOnce);
    });

    it('should pass for valid token', () => {
      mockRequest = {
        params: {
          domainOrToken:
            '53115498937382692782103703677178119840631903773202805882273058578308100329417',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(next.calledOnce);
    });

    it('should pass for valid namehash', () => {
      mockRequest = {
        params: {
          domainOrToken:
            '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(next.calledOnce);
    });

    it('should not pass for valid token', () => {
      mockRequest = {
        params: {
          domainOrToken: 'zsdasa',
        },
      } as Request & { params: any };

      expect(() => middleware(mockRequest, mockResponse, next)).to.throw(
        'Invalid token',
      );

      expect(next).to.not.called;
    });

    it('should not pass for valid domain', () => {
      mockRequest = {
        params: {
          domainOrToken: '+name+.crypto',
        },
      } as Request & { params: any };

      expect(() => middleware(mockRequest, mockResponse, next)).to.throw(
        'Invalid domain name',
      );

      expect(next).to.not.called;
    });

    it('should not pass for valid TLD', () => {
      mockRequest = {
        params: {
          domainOrToken: 'name.cryptoss',
        },
      } as Request & { params: any };

      expect(() => middleware(mockRequest, mockResponse, next)).to.throw(
        'Unsupported TLD',
      );

      expect(next).to.not.called;
    });
  });

  describe('ValidateAndTransformOnDomainName', () => {
    const middleware = ValidateAndTransformOnDomainName('domain');

    it('should pass for input valid domain name', () => {
      mockRequest = {
        params: {
          domain: 'abcde.crypto',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(next.calledOnce);
    });

    it('should pass trim input', () => {
      mockRequest = {
        params: {
          domain: '   abcde.crypto',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(mockRequest.params.domain).to.eql('abcde.crypto');

      expect(next.calledOnce);
    });

    it('should pass for valid TLDs', () => {
      mockRequest = {
        params: {
          domain: 'crypto',
        },
      } as Request & { params: any };

      middleware(mockRequest, mockResponse, next);

      expect(next.calledOnce);
    });

    it('should not pass for valid domain', () => {
      mockRequest = {
        params: {
          domain: '+name+.crypto',
        },
      } as Request & { params: any };

      expect(() => middleware(mockRequest, mockResponse, next)).to.throw(
        'Invalid domain name',
      );

      expect(next).to.not.called;
    });

    it('should not pass for valid TLD', () => {
      mockRequest = {
        params: {
          domain: 'name.cryptoss',
        },
      } as Request & { params: any };

      expect(() => middleware(mockRequest, mockResponse, next)).to.throw(
        'Unsupported TLD',
      );

      expect(next).to.not.called;
    });
  });
});
