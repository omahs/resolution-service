import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGINIndexOnResolution1665435054447
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX resolutionGin ON domains_resolution USING gin (resolution)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX resolutionGin`);
  }
}
