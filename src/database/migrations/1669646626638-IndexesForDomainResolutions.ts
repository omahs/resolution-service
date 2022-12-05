import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexesForDomainResolutions1669646626638
  implements MigrationInterface
{
  name = 'IndexesForDomainResolutions1669646626638';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bd2fbeb876cb9c1784da6edf93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "UQ_16efa381afd8187533c52240211"`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ALTER COLUMN "domain_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_resolution"."domain_id" IS 'the resolution domain'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ba221474637efa543760216b5d" ON "domains_resolution" ("domain_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd2fbeb876cb9c1784da6edf93" ON "domains_resolution" ("domain_id", "blockchain", "network_id", "owner_address") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fffaf1e63f42f64bd2b317ad8c" ON "domains_reverse_resolution" ("domain_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "UQ_16efa381afd8187533c52240211" UNIQUE ("domain_id", "blockchain", "network_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "UQ_16efa381afd8187533c52240211"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fffaf1e63f42f64bd2b317ad8c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bd2fbeb876cb9c1784da6edf93"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ba221474637efa543760216b5d"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_resolution"."domain_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ALTER COLUMN "domain_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "UQ_16efa381afd8187533c52240211" UNIQUE ("blockchain", "network_id", "domain_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd2fbeb876cb9c1784da6edf93" ON "domains_resolution" ("owner_address", "blockchain", "network_id", "domain_id") `,
    );
  }
}
