import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanReverseResolutions1664366869085
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        DELETE FROM domains_reverse_resolution 
        WHERE domains_reverse_resolution.id NOT IN (
          SELECT id FROM 
           (
               SELECT 
                  id, created_at, reverse_address, blockchain, network_id,
                  RANK() OVER (PARTITION BY reverse_address, blockchain, network_id ORDER BY created_at DESC) dest_rank
               FROM domains_reverse_resolution
           ) as tmp where dest_rank = 1
        )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not applicable
  }
}
