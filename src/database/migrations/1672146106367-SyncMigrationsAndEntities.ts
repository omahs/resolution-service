import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncMigrationsAndEntities1672146106367
  implements MigrationInterface
{
  name = 'SyncMigrationsAndEntities1672146106367';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b1fb6a16c3def29f6272a8d063"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resolution_worker_status" DROP CONSTRAINT "resolution_worker_status_location_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b1fb6a16c3def29f6272a8d063" ON "resolution_worker_status" ("location") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b1fb6a16c3def29f6272a8d063"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resolution_worker_status" ADD CONSTRAINT "resolution_worker_status_location_key" UNIQUE ("location")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b1fb6a16c3def29f6272a8d063" ON "resolution_worker_status" ("location") `,
    );
  }
}
