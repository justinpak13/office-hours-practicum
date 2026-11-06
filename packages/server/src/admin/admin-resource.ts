import {
  Brackets,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

export interface EntityPage<T> {
  entities: T[];
  count: number;
}

export abstract class AdminResource<T extends ObjectLiteral> {
  abstract readonly alias: string;
  listDisplay: string[] = [];
  searchFields: string[] = [];
  fields: string[] = [];
  resultsPerPage = 25;

  constructor(protected readonly repository: Repository<T>) {}

  protected baseQuery(): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(this.alias);
  }

  // Default behavior: paginate, and ILIKE each search term against searchFields
  async getEntityList(
    page = 1,
    searchString = '',
  ): Promise<EntityPage<unknown>> {
    const query = this.baseQuery()
      .skip(this.resultsPerPage * (page - 1))
      .take(this.resultsPerPage);

    if (this.searchFields.length) {
      searchString
        .split(' ')
        .filter(Boolean)
        .forEach((term, i) => {
          query.andWhere(
            new Brackets((qb) => {
              this.searchFields.forEach((field, j) => {
                const clause = `${this.alias}.${field}::text ILIKE :term${i}`;
                j === 0
                  ? qb.where(clause, { [`term${i}`]: `%${term}%` })
                  : qb.orWhere(clause);
              });
            }),
          );
        });
    }

    const [entities, count] = await query.getManyAndCount();
    return { entities, count };
  }
}
