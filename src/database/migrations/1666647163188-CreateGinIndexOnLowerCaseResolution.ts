import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGinIndexOnLowerCaseResolution1666647163188
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `CREATE INDEX resolutionLowerCaseGin ON domains_resolution USING gin ((lower(resolution::text)::jsonb))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`DROP INDEX resolutionLowerCaseGin`);
  }
}
