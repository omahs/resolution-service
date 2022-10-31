import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateApiKeyType1666351019964 implements MigrationInterface {
  name = 'UpdateApiKeyType1666351019964';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT "UQ_e3bfdf021596dfcfd149e7c88a7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "api_key" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "api_key" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "UQ_9ccce5863aec84d045d778179de" UNIQUE ("api_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ccce5863aec84d045d778179d" ON "api_keys" ("api_key") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_9ccce5863aec84d045d778179d"`);
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT "UQ_9ccce5863aec84d045d778179de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "api_key" TYPE uuid USING api_key::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "api_key" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "UQ_e3bfdf021596dfcfd149e7c88a7" UNIQUE ("api_key")`,
    );
  }
}
