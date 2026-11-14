import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { UserModel } from 'profile/user.entity';

@Injectable()
export class BackfillMakeEmptyPhotoURLNull {
  @Command({
    command: 'backfill:make-empty-photoURL-null',
    describe: 'changes empty string photoURLs to null',
  })
  async fix(): Promise<void> {
    // Load and save only the rows with an empty photoURL, not the whole table
    const users = await UserModel.find({ where: { photoURL: '' } });
    users.forEach((user) => {
      user.photoURL = null;
    });

    await UserModel.save(users);

    console.log(`Updated photo URLs for ${users.length} users`);
  }
}
