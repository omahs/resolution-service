import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { env } from '../env';
import ApiKey from '../models/ApiKey';

describe('EnrollmentController', () => {
  describe('POST /enroll', () => {
    const testKeyName = 'testname';
    const testKey = 'testkey';

    it('should check auth', async () => {
      const enroll = await supertest(api).post('/enroll').send({
        key: testKey,
        name: testKeyName,
      });
      expect(enroll.statusCode).to.equal(403);
      expect(enroll.body).to.containSubset({
        code: 'ForbiddenError',
        errors: [
          {
            message: 'Please provide a valid app token.',
          },
        ],
      });
    });

    it('should save api key', async () => {
      const enroll = await supertest(api)
        .post('/enroll')
        .send({
          key: testKey,
          name: testKeyName,
        })
        .set('app-auth-token', env.APPLICATION.APP_AUTH_KEY);

      expect(enroll.statusCode).to.equal(200);

      const dbKey = await ApiKey.queryApiKey(testKey);
      expect(dbKey).to.exist;
      expect(dbKey?.name).to.eq(testKeyName);
    });

    it('should not save existing key', async () => {
      await ApiKey.create({
        name: testKeyName,
        apiKey: testKey,
      }).save();

      const enroll = await supertest(api)
        .post('/enroll')
        .send({
          key: testKey,
          name: 'newtestkey',
        })
        .set('app-auth-token', env.APPLICATION.APP_AUTH_KEY);
      expect(enroll.statusCode).to.equal(400);
      expect(enroll.body).to.containSubset({
        code: 'BadRequestError',
        errors: [
          {
            message: 'Key exists.',
          },
        ],
      });
    });

    describe('validations', () => {
      const testCases = [
        {
          description: 'should validate empty key',
          body: { key: '', name: testKeyName },
          expectedError: { isNotEmpty: 'key should not be empty' },
        },
        {
          description: 'should validate non-string key',
          body: { key: 11, name: testKeyName },
          expectedError: { isString: 'key must be a string' },
        },
        {
          description: 'should validate empty name',
          body: { key: testKey, name: '' },
          expectedError: { isNotEmpty: 'name should not be empty' },
        },
        {
          description: 'should validate non-string name',
          body: { key: testKey, name: 11 },
          expectedError: { isString: 'name must be a string' },
        },
      ];

      testCases.forEach((testCase) => {
        it(testCase.description, async () => {
          const enroll = await supertest(api)
            .post('/enroll')
            .send(testCase.body)
            .set('app-auth-token', env.APPLICATION.APP_AUTH_KEY);

          expect(enroll.statusCode).to.equal(400);
          expect(enroll.body).to.containSubset({
            code: 'BadRequestError',
            errors: [
              {
                constraints: testCase.expectedError,
              },
            ],
          });
        });
      });
    });
  });
});
