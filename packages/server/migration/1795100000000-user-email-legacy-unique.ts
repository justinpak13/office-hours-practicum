import { MigrationInterface, QueryRunner } from 'typeorm';

// T12's old constraint name (local/test DBs may still have it), and the index name declared on UserModel
const UQ = 'UQ_864bd044bba869304084843358e';
const IDX = 'IDX_user_model_email_legacy';

export class userEmailLegacyUnique1795100000000 implements MigrationInterface {
  name = 'userEmailLegacyUnique1795100000000';

  // NOTE: emails are unique only among legacy rows (no Keycloak sub); a Keycloak user may share an email with one
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dups: { email: string }[] = await queryRunner.query(
      `SELECT email FROM "user_model" WHERE "keycloakSub" IS NULL GROUP BY email HAVING COUNT(*) > 1 LIMIT 5`,
    );
    if (dups.length > 0) {
      throw new Error(
        `Cannot add the legacy-only unique email index: duplicate emails among legacy rows, merge them first: ${dups
          .map((d) => d.email)
          .join(', ')}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP CONSTRAINT IF EXISTS "${UQ}"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "${IDX}" ON "user_model" ("email") WHERE "keycloakSub" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "${IDX}"`);
  }
}
