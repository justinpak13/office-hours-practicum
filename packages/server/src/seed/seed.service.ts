import { Injectable } from '@nestjs/common';

@Injectable()
export class SeedService {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(private connection: Connection) {}
  async deleteAll(model: any) {
    await this.connection.createQueryBuilder().delete().from(model).execute();
  }
}
