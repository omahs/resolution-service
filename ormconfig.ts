import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { env } from './src/env';
import SnakeNamingStrategy from './src/database/SnakeNamingStrategy';
import InMemoryCacheProvider from 'typeorm-in-memory-cache';

export = {
  ...env.TYPEORM,
  migrationsTableName: 'typeorm_migration',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  cli: {
    entitiesDir: 'src/models',
    migrationsDir: 'src/database/migrations',
  },
  cache: {
    provider() {
      return new InMemoryCacheProvider();
    },
  },
} as PostgresConnectionOptions;
