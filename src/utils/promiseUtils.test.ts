import { expect } from 'chai';
import { withPromiseTimeout } from './promiseUtils';

describe('Promise utils', () => {
  describe('withPromiseTimeout', () => {
    it('should reject if the main promise take more time than limit', async () => {
      const mockData = ['hello world!'];

      const mainPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve(mockData);
        }, 1000);
      });

      await expect(withPromiseTimeout(mainPromise, 500)).to.be.rejectedWith(
        'Promise is rejected for timeout',
      );
    });

    it('should return the main promise data', async () => {
      const mockData = ['hello world!'];

      const mainPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve(mockData);
        }, 500);
      });

      await expect(withPromiseTimeout(mainPromise, 1000)).to.eventually.eql(
        mockData,
      );
    });

    it('should reject with the error of the main promise', async () => {
      const mainPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject('Something is wrong!');
        }, 500);
      });

      await expect(withPromiseTimeout(mainPromise, 500)).to.be.rejectedWith(
        'Something is wrong!',
      );
    });

    it('should throw an error if time limit is smaller than 0', async () => {
      expect(() => withPromiseTimeout(Promise.resolve(true), -1)).to.throw(
        'Invalid timeout argument',
      );
    });

    it('should throw an error if time limit is 0', async () => {
      expect(() => withPromiseTimeout(Promise.resolve(true), 0)).to.throw(
        'Invalid timeout argument',
      );
    });
  });
});
