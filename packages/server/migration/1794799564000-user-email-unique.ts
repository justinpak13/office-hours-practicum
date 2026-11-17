import { MigrationInterface, QueryRunner } from 'typeorm';

// Same name the entity's `unique: true` generates
const UQ = 'UQ_864bd044bba869304084843358e';

export class userEmailUnique1794799564000 implements MigrationInterface {
  name = 'userEmailUnique1794799564000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dups: { email: string }[] = await queryRunner.query(
      `SELECT email FROM "user_model" GROUP BY email HAVING COUNT(*) > 1 LIMIT 5`,
    );
    if (dups.length > 0) {
      throw new Error(
        `Cannot add UNIQUE(email) to user_model: duplicate emails exist, merge them first: ${dups
          .map((d) => d.email)
          .join(', ')}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD CONSTRAINT "${UQ}" UNIQUE ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_model" DROP CONSTRAINT "${UQ}"`);
  }
}
