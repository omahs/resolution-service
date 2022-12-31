import { MigrationInterface, QueryRunner } from 'typeorm';
import { WorkerStatus } from '../../models';
import { Blockchain } from '../../types/common';

export class ZNSStatusSwapAtxuidAndBlockNum1672504312180
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const repo = queryRunner.manager.getRepository(WorkerStatus);
    const status = await repo.findOne({
      where: { blockchain: Blockchain.ZIL },
    });
    if (status) {
      status.lastMirroredBlockNumber = status.lastAtxuid || 0;
      await repo.save(status);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // N/A need to undo manually
  }
}
