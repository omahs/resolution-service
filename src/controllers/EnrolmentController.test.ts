import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { env } from '../env';
import ApiKey from '../models/ApiKey';

describe('EnrolmentController', () => {
  describe('POST /enrol', () => {
    const testKeyName = 'testname';
    const testKey = 'testkey';

    it('should check auth', async () => {
      const enrol = await supertest(api).post('/enrol').send({
        key: testKey,
        name: testKeyName,
      });
      expect(enrol.statusCode).to.equal(403);
      expect(enrol.body).to.containSubset({
        code: 'ForbiddenError',
        errors: [
          {
            message: 'Please provide a valid app token.',
          },
        ],
      });
    });

    it('should save api key', async () => {
      const enrol = await supertest(api)
        .post('/enrol')
        .send({
          key: testKey,
          name: testKeyName,
        })
        .set('reseller-app-token', env.APPLICATION.RESELLER_APP_KEY);

      expect(enrol.statusCode).to.equal(200);

      const dbKey = await ApiKey.queryApiKey(testKey);
      expect(dbKey).to.exist;
      expect(dbKey?.name).to.eq(testKeyName);
    });

    it('should not save existing key', async () => {
      await ApiKey.create({
        name: testKeyName,
        apiKey: testKey,
      }).save();

      const enrol = await supertest(api)
        .post('/enrol')
        .send({
          key: testKey,
          name: 'newtestkey',
        })
        .set('reseller-app-token', env.APPLICATION.RESELLER_APP_KEY);
      expect(enrol.statusCode).to.equal(400);
      expect(enrol.body).to.containSubset({
        code: 'BadRequestError',
        errors: [
          {
            message: 'Key exists.',
          },
        ],
      });
    });

    describe('validations', () => {
      const cases = [
        {
          desc: 'should validate empty key',
          body: { key: '', name: testKeyName },
          expectedError: { isNotEmpty: 'key should not be empty' },
        },
        {
          desc: 'should validate non-string key',
          body: { key: 11, name: testKeyName },
          expectedError: { isString: 'key must be a string' },
        },
        {
          desc: 'should validate empty name',
          body: { key: testKey, name: '' },
          expectedError: { isNotEmpty: 'name should not be empty' },
        },
        {
          desc: 'should validate non-string name',
          body: { key: testKey, name: 11 },
          expectedError: { isString: 'name must be a string' },
        },
      ];

      cases.forEach((c) => {
        it(c.desc, async () => {
          const enrol = await supertest(api)
            .post('/enrol')
            .send(c.body)
            .set('reseller-app-token', env.APPLICATION.RESELLER_APP_KEY);

          expect(enrol.statusCode).to.equal(400);
          expect(enrol.body).to.containSubset({
            code: 'BadRequestError',
            errors: [
              {
                constraints: c.expectedError,
              },
            ],
          });
        });
      });
    });
  });
});
