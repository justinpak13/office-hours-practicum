import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SeedService {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(private connection: DataSource) {}
  async deleteAll(model: any) {
    await this.connection.createQueryBuilder().delete().from(model).execute();
  }
}
