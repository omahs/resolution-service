import { Column, Entity, In, Index, Repository } from 'typeorm';
import { IsString } from 'class-validator';
import { Model } from '.';
import { Attributes } from '../types/common';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../env';
import { buildBatchLoader } from '../utils/batchLoader';

const apiKeyLoader = buildBatchLoader<string, ApiKey>(
  (keys: readonly string[]) =>
    ApiKey.find({
      where: { apiKey: In(keys as string[]) },
      cache: env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME || undefined,
    }),
  (apiKey) => apiKey.apiKey,
  {
    name: 'ApiKeyBatchLoader',
  },
);

@Entity({ name: 'api_keys' })
export default class ApiKey extends Model {
  @IsString()
  @Column('text', { unique: true })
  name: string;

  @Index()
  @Column('text', { unique: true })
  apiKey: string;

  constructor(attributes?: Attributes<ApiKey>) {
    super();
    this.attributes<ApiKey>(attributes);
  }

  static async queryApiKey(apiKey: string): Promise<ApiKey | undefined> {
    const key = await apiKeyLoader.load(apiKey);
    return key instanceof Error ? undefined : key;
  }

  static async createApiKey(
    name: string,
    repository: Repository<ApiKey> = this.getRepository(),
  ): Promise<ApiKey> {
    const newKey = new ApiKey();
    newKey.attributes({
      name: name,
      apiKey: uuidv4(),
    });
    await repository.save(newKey);
    return newKey;
  }
}
