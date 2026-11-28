import { MigrationInterface, QueryRunner } from 'typeorm';

export class addNuidToUser1794950000000 implements MigrationInterface {
  name = 'addNuidToUser1794950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_model" ADD "nuid" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_model" DROP COLUMN "nuid"`);
  }
}
