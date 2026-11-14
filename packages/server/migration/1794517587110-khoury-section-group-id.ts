import { MigrationInterface, QueryRunner } from 'typeorm';

export class khourySectionGroupId1794517587110 implements MigrationInterface {
  name = 'khourySectionGroupId1794517587110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "khourySectionGroupId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "UQ_facc8b86543dc446c292250928d" UNIQUE ("khourySectionGroupId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "khouryRosterGeneratedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "khouryRosterGeneratedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "UQ_facc8b86543dc446c292250928d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "khourySectionGroupId"`,
    );
  }
}
