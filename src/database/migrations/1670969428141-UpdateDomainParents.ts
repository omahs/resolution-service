import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../logger';

export class UpdateDomainParents1670969428141 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`
        CREATE FUNCTION sld_of_domain(domainName text)
          returns text
          language plpgsql
          as
          $$
          declare
            split_domain_name_array TEXT[];
            result TEXT;
          BEGIN
            SELECT 
              regexp_split_to_array(domainName, E'\\\\.')
            INTO 
              split_domain_name_array
            ;
            SELECT CASE
              WHEN 
                array_length(split_domain_name_array, 1) > 2 
              THEN 
                array_to_string(
                  split_domain_name_array[
                    (array_length(split_domain_name_array, 1) - 1)
                    :
                    array_length(split_domain_name_array, 1)
                  ],
                  '.'
                )
              ELSE 
                split_domain_name_array[array_length(split_domain_name_array, 1)]
              END 
            INTO result;
            return result;
          END;
        $$;
  
        UPDATE 
          domains
        SET
          parent_id = parent.id
        FROM
          domains domain
        JOIN
          domains parent
        ON 
          sld_of_domain(domain.name)=parent.name
        WHERE 
          domains.parent_id IS NOT NULL
        AND
          array_length(regexp_split_to_array(domains.name, E'\\\\.'), 1) > 2
        AND
          domains.name = domain.name;
      
        DROP FUNCTION sld_of_domain;
      `);
    } catch (error: any) {
      logger.error('Unsuccessful Migration was ran', error);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`
        CREATE FUNCTION previous_sld_of_domain(domainName text)
          returns text
          language plpgsql
          as
          $$
          declare
            split_domain_name_array TEXT[];
            result TEXT;
          BEGIN
            SELECT 
              regexp_split_to_array(domainName, E'\\\\.')
            INTO 
              split_domain_name_array;
            SELECT 
              split_domain_name_array[array_length(split_domain_name_array, 1)] 
            INTO 
              result
            ;
            return result;
          END;
        $$;

        UPDATE 
          domains
        SET
          parent_id = parent.id
        FROM
          domains domain
        JOIN
          domains parent
        ON 
          previous_sld_of_domain(domain.name)=parent.name
        WHERE 
          domains.parent_id IS NOT NULL
        AND
          array_length(regexp_split_to_array(domains.name, E'\\\\.'), 1) > 2
        AND
          domains.name = domain.name;

        DROP FUNCTION previous_sld_of_domain;
      `);
    } catch (error: any) {
      logger.error('Unsuccessful Migration was ran', error);
    }
  }
}
