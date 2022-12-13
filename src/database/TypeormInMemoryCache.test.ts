import { InMemoryCacheProvider } from './TypeormInMemoryCache';
const Cache = new InMemoryCacheProvider();
import { env } from '../env';
import { expect } from 'chai';

describe('InMemoryCacheProvider Tests', async () => {
  const options = {
    identifier: 'test',
    duration: env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME,
    time: Date.now(),
    query: 'testingQuery',
    result: 'tesResult',
  };

  const options1 = {
    identifier: 'test1',
    duration: -10000,
    time: Date.now(),
    query: 'testingQuery1',
    result: 'tesResult1',
  };

  it('should be able to store and receive from in-memory cache', async () => {
    await Cache.storeInCache(options);

    const cachedObject = await Cache.getFromCache(options);
    expect(JSON.stringify(cachedObject)).to.be.equal(JSON.stringify(options));
  });

  it('should be able to determine if cached data is and is not expired', async () => {
    const isExpired = Cache.isExpired(options);
    const isExpired1 = Cache.isExpired(options1);
    expect(isExpired).to.be.equal(false);
    expect(isExpired1).to.be.equal(true);
  });

  it('should be able to determine if cached data is expired', async () => {
    const isExpired = Cache.isExpired(options1);
    expect(isExpired).to.be.equal(true);
  });

  it('should be able to retrieve the cache stats', async () => {
    const stats = Cache.getStatistics();
    const assumedCacheStats = {
      hits: 1,
      misses: 0,
      keys: 1,
      ksize: 4,
      vsize: 400,
    };
    expect(JSON.stringify(stats)).to.be.equal(
      JSON.stringify(assumedCacheStats),
    );
  });

  it('should be able to remove from in-memory cache', async () => {
    await Cache.remove(['test']);
    const cachedObject = await Cache.getFromCache(options);
    expect(cachedObject).to.be.equal(undefined);
  });

  it('should be able to flush the cache', async () => {
    await Cache.storeInCache(options);
    await Cache.storeInCache(options1);
    await Cache.clear();
    const cachedObject = await Cache.getFromCache(options);
    const cachedObject1 = await Cache.getFromCache(options1);

    expect(cachedObject).to.be.equal(undefined);
    expect(cachedObject1).to.be.equal(undefined);
  });
});
