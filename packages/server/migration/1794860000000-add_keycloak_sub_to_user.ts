import { MigrationInterface, QueryRunner } from 'typeorm';

export class addKeycloakSubToUser1794860000000 implements MigrationInterface {
  name = 'addKeycloakSubToUser1794860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_model" ADD "keycloakSub" text`);
    // Postgres allows many NULLs in a unique index, so existing users are fine
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_model_keycloakSub" ON "user_model" ("keycloakSub")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_model_keycloakSub"`);
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "keycloakSub"`,
    );
  }
}
