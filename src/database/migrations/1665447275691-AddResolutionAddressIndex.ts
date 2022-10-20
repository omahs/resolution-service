import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResolutionAddressIndex1665447275691
  implements MigrationInterface
{
  name = 'AddResolutionAddressIndex1665447275691';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_c945d466e308bfb10aa7f69014" ON "domains_resolution" ("owner_address")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c945d466e308bfb10aa7f69014"`,
    );
  }
}
