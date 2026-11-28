import { Command } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { UserModel } from 'profile/user.entity';

@Injectable()
export class BackfillDefaultUserTeamsMessages {
  @Command({
    command: 'backfill:default-user-teams-messages',
    describe: 'set default Teams chat message for all users.',
  })
  async fix(): Promise<void> {
    // Only users without a message, so custom messages are never overwritten
    const users = await UserModel.find({
      where: [{ defaultMessage: IsNull() }, { defaultMessage: '' }],
    });

    users.forEach((user) => {
      user.defaultMessage = `Hello! I'm ${user.firstName}. How can I help you today?`;
    });

    await UserModel.save(users);
    console.log(`Set a default Teams message for ${users.length} users`);
  }
}
