import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  KhouryAdminError,
  RosterResponse,
  SectionGroupsResponse,
  UserCoursesResponse,
} from './khoury-admin.types';

const isArr = Array.isArray;
// Private on purpose; the exported normalizeEmail lives in the sync service (T12).
const norm = (e: string) =>
  e.toLowerCase().replace(/@husky\.neu\.edu$/, '@northeastern.edu');
const isStr = (x: any) => typeof x === 'string';
const every = (a: any, f: (x: any) => boolean) => isArr(a) && a.every(f);
const isPerson = (p: any) =>
  !!p && isStr(p.email) && isStr(p.first_name) && isStr(p.last_name);

@Injectable()
export class KhouryAdminClient {
  constructor(private http: HttpService, private config: ConfigService) {}

  getSectionGroups(
    email: string,
    semester: string,
  ): Promise<SectionGroupsResponse> {
    return this.get(
      `/api/v1/instructors/${encodeURIComponent(
        norm(email),
      )}/section-groups?semester=${encodeURIComponent(semester)}`,
      (d) =>
        isStr(d.semester) &&
        every(
          d.section_groups,
          (g) =>
            !!g &&
            isStr(g.id) &&
            isStr(g.name) &&
            every(g.crns, (n) => typeof n === 'number'),
        ),
    );
  }

  getCourses(email: string, semester: string): Promise<UserCoursesResponse> {
    return this.get(
      `/api/v1/users/${encodeURIComponent(
        norm(email),
      )}/courses?semester=${encodeURIComponent(semester)}`,
      (d) =>
        isStr(d.semester) &&
        every(
          d.courses,
          (c) =>
            !!c &&
            isStr(c.section_group_id) &&
            ['Professor', 'TA', 'Student'].includes(c.role),
        ),
    );
  }

  /** null on 404 */
  getRoster(id: string): Promise<RosterResponse | null> {
    return this.get(
      `/api/v1/section-groups/${encodeURIComponent(id)}/roster`,
      (d) =>
        isStr(d.id) &&
        isStr(d.name) &&
        isStr(d.semester) &&
        isStr(d.generated_at) &&
        !isNaN(Date.parse(d.generated_at)) &&
        every(d.professors, isPerson) &&
        every(d.tas, isPerson) &&
        every(
          d.sections,
          (x) =>
            !!x && typeof x.crn === 'number' && every(x.students, isPerson),
        ),
      true,
    );
  }

  private async get(
    path: string,
    valid: (d: any) => boolean,
    nullOn404 = false,
  ): Promise<any> {
    // read on every call, never cached
    const url = this.config.get('KHOURY_ADMIN_URL') + path;
    let res;
    try {
      res = await firstValueFrom(
        this.http.get(url, { timeout: 5000, validateStatus: () => true }),
      );
    } catch (e) {
      throw new KhouryAdminError(`Khoury Admin request failed: ${e.message}`);
    }
    if (nullOn404 && res.status === 404) return null;
    if (res.status < 200 || res.status >= 300) {
      throw new KhouryAdminError(`Khoury Admin returned ${res.status}`);
    }
    const d = res.data;
    if (!d || typeof d !== 'object' || !valid(d)) {
      throw new KhouryAdminError('Khoury Admin returned a bad response shape');
    }
    return d;
  }
}
