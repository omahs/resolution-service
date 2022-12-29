import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../logger';

export class UpdateSubdomainParentIds1672176442312
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`
        UPDATE domains
        SET parent_id = from_table.parent_id 
        FROM (
          SELECT domains.id AS parent_id, c.parent_name AS parent_name, c.id, c.name FROM (
            SELECT (array_to_string(t.split_domain_name[
              (array_length(t.split_domain_name, 1) - 1) : array_length(t.split_domain_name, 1)
            ], '.')) as parent_name, id, name
            FROM (
              SELECT regexp_split_to_array(domains.name, E'\\\\.') AS split_domain_name, id, name, parent_id 
              FROM domains 
              WHERE array_length(regexp_split_to_array(domains.name, E'\\\\.'), 1) > 2
            ) t
          ) AS c JOIN domains ON c.parent_name = domains.name
        ) from_table 
        WHERE array_length(regexp_split_to_array(domains.name, E'\\\\.'), 1) > 2
        AND from_table.name = domains.name;
      `);
    } catch (error: any) {
      logger.error('Unsuccessful Migration was ran', error);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`
        UPDATE domains
        SET parent_id = from_table.parent_id 
        FROM (
          SELECT domains.id AS parent_id, c.parent_name AS parent_name, c.id, c.name FROM (
            SELECT (t.split_domain_name[array_length(t.split_domain_name, 1)]) as parent_name, id, name
            FROM (
              SELECT regexp_split_to_array(domains.name, E'\\\\.') AS split_domain_name, id, name, parent_id 
              FROM domains 
              WHERE array_length(regexp_split_to_array(domains.name, E'\\\\.'), 1) > 2
            ) t
          ) AS c JOIN domains ON c.parent_name = domains.name
        ) from_table 
        WHERE array_length(regexp_split_to_array(domains.name, E'\\\\.'), 1) > 2
        AND from_table.name = domains.name;
      `);
    } catch (error: any) {
      logger.error('Unsuccessful Migration was ran', error);
    }
  }
}
