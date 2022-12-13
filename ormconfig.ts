import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { env } from './src/env';
import SnakeNamingStrategy from './src/database/SnakeNamingStrategy';
import InMemoryCache from './src/database/TypeormInMemoryCache';

export = {
  ...env.TYPEORM,
  migrationsTableName: 'typeorm_migration',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  cli: {
    entitiesDir: 'src/models',
    migrationsDir: 'src/database/migrations',
  },
  ...(!env.CACHE.IN_MEMORY_CACHE_DISABLED && {
    cache: {
      provider() {
        return InMemoryCache;
      },
    },
  }),
} as PostgresConnectionOptions;
