import { MigrationInterface, QueryRunner } from 'typeorm';
import { WorkerStatus } from '../../models';
import { Blockchain } from '../../types/common';

export class ZNSStatusSwapAtxuidAndBlockNum1672504312180
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "resolution_worker_status" SET last_mirrored_block_number=last_atxuid WHERE location='ZIL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // N/A need to undo manually
  }
}
