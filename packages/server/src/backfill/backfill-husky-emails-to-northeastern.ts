import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { Like } from 'typeorm';
import { UserModel } from 'profile/user.entity';

@Injectable()
export class BackfillHuskyEmailsAsNortheastern {
  @Command({
    command: 'backfill:husky-emails-to-northeastern',
    describe: 'Converts @husky.neu.edu emails to @northeastern.edu emails',
  })
  async fix(): Promise<void> {
    // Load and save only the husky addresses, not the whole table
    const users = await UserModel.find({
      where: { email: Like('%@husky.neu.edu') },
    });

    users.forEach((user) => {
      user.email = user.email.replace('@husky.neu.edu', '@northeastern.edu');
    });

    await UserModel.save(users);
    console.log(`Updated the emails of ${users.length} users`);
  }
}
