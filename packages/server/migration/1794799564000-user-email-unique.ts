import { MigrationInterface } from 'typeorm';

export class userEmailUnique1794799564000 implements MigrationInterface {
  name = 'userEmailUnique1794799564000';

  public async up(): Promise<void> {
    // NOTE: superseded by userEmailLegacyUnique1795100000000 (legacy-only email index) before ever deploying, so this does nothing
  }

  public async down(): Promise<void> {
    // NOTE: nothing to undo; see up()
  }
}
