import { MigrationInterface, QueryRunner } from 'typeorm';

// SMS notifications via Twilio were removed; drop the leftover schema.
// down() restores the structure only — phone numbers are not recoverable.
export class dropPhoneNotifs1795027717809 implements MigrationInterface {
  name = 'dropPhoneNotifs1795027717809';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "phone_notif_model"`);
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "phoneNotifsEnabled"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "phoneNotifsEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE TABLE "phone_notif_model" ("id" SERIAL NOT NULL, "phoneNumber" text NOT NULL, "userId" integer, "verified" boolean NOT NULL, CONSTRAINT "REL_19336b4c7b95400d021ba57200" UNIQUE ("userId"), CONSTRAINT "PK_f13c8dd6825f896d403bfa18a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "phone_notif_model" ADD CONSTRAINT "FK_19336b4c7b95400d021ba572001" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
