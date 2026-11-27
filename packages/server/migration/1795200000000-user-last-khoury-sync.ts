import { MigrationInterface, QueryRunner } from 'typeorm';

export class userLastKhourySync1795200000000 implements MigrationInterface {
  name = 'userLastKhourySync1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "lastKhourySyncAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "lastKhourySyncAt"`,
    );
  }
}
