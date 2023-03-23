import { MigrationInterface, QueryRunner } from 'typeorm';
import supportedKeysJson from 'uns/resolver-keys.json';

export class ResolutionLowerCaseIndexes1679514891940
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const proms = [];
    const keys = Object.keys(supportedKeysJson.keys);
    for (const key of keys) {
      proms.push(
        queryRunner.query(
          `CREATE INDEX IF NOT EXISTS "hash_resolution_lower_${key}" on domains_resolution USING HASH( LOWER(resolution->>'${key}') )`,
        ),
      );
    }
    await Promise.all(proms);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const proms = [];
    const keys = Object.keys(supportedKeysJson.keys);
    for (const key of keys) {
      proms.push(
        queryRunner.query(
          `DROP INDEX IF EXISTS "hash_resolution_lower_${key}"`,
        ),
      );
    }
    await Promise.all(proms);
  }
}
