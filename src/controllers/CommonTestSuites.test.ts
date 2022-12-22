import supertest from 'supertest';
import { expect } from 'chai';

import { api } from '../api';
import { ApiKey } from '../models';

export function commonParamsValidatorTestSuite(options: {
  getPath: (domainOrToken: string) => string;
  isAuthRequired?: boolean;
  includeDomainNameTests: boolean;
  includeTokenTests: boolean;
}) {
  const {
    getPath,
    isAuthRequired = false,
    includeDomainNameTests,
    includeTokenTests,
  } = options;

  describe(`Validate input: ${getPath(':domainOrToken')}`, () => {
    let testApiKey: ApiKey;

    beforeEach(async () => {
      testApiKey = await ApiKey.createApiKey('test key');
    });

    afterEach(async () => {
      await testApiKey.remove();
    });

    if (includeDomainNameTests) {
      it('should throw an error if invalid domainName extension is supplied', async () => {
        const request = supertest(api).get(getPath('test.json'));

        if (isAuthRequired) {
          void request.auth(testApiKey.apiKey, { type: 'bearer' });
        }
        const response = await request.send();

        expect(response.statusCode).to.equal(400);
        expect(response.body.code).to.equal('InvalidInputError');
        expect(response.body.message).to.equal('Unsupported TLD');
      });

      it('should throw an error if invalid domainName format is supplied', async () => {
        const request = supertest(api).get(getPath('+name+.crypto'));

        if (isAuthRequired) {
          void request.auth(testApiKey.apiKey, { type: 'bearer' });
        }
        const response = await request.send();
        expect(response.statusCode).to.equal(400);
        expect(response.body.code).to.equal('InvalidInputError');
        expect(response.body.message).to.equal('Invalid domain name');
      });
    }

    if (includeTokenTests) {
      it('should throw an error if invalid token is supplied', async () => {
        const response = await supertest(api).get(getPath('asdfgh')).send();

        expect(response.statusCode).to.equal(400);
        expect(response.body.code).to.equal('InvalidInputError');
        expect(response.body.message).to.equal('Invalid token');
      });
    }
  });
}
