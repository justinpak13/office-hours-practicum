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
// NOTE: mirrors normalizeEmail in khoury-admin-sync.service.ts; importing it here would create an import cycle.
const norm = (e: string) =>
  e.toLowerCase().replace(/@husky\.neu\.edu$/, '@northeastern.edu');
// NOTE: a lone surrogate makes encodeURIComponent throw URIError; surface it as a normal client failure
const enc = (x: string) => {
  try {
    return encodeURIComponent(x);
  } catch {
    throw new KhouryAdminError('Khoury Admin request has a malformed value');
  }
};
const isStr = (x: any) => typeof x === 'string';
const isId = (x: any) => isStr(x) && x !== '' && x === x.trim();
// NOTE: group ids are sg_ + 18 digits; NUID keeps the looser isId
const isGid = (x: any) => isStr(x) && /^sg_\d{18}$/.test(x);
const every = (a: any, f: (x: any) => boolean) => isArr(a) && a.every(f);
const isPerson = (p: any) =>
  !!p &&
  isStr(p.email) &&
  isId(p.nuid) &&
  isStr(p.first_name) &&
  isStr(p.last_name);

@Injectable()
export class KhouryAdminClient {
  constructor(private http: HttpService, private config: ConfigService) {}

  async getSectionGroups(
    email: string,
    semester: string,
  ): Promise<SectionGroupsResponse> {
    return this.get(
      `/api/v1/instructors/${enc(norm(email))}/section-groups?semester=${enc(
        semester,
      )}`,
      (d) =>
        d.semester === semester &&
        every(
          d.section_groups,
          (g) =>
            !!g &&
            isGid(g.id) &&
            isStr(g.name) &&
            every(g.crns, (n) => typeof n === 'number'),
        ),
    );
  }

  async getCourses(
    email: string,
    semester: string,
  ): Promise<UserCoursesResponse> {
    return this.get(
      `/api/v1/users/${enc(norm(email))}/courses?semester=${enc(semester)}`,
      (d) =>
        d.semester === semester &&
        every(
          d.courses,
          (c) =>
            !!c &&
            isGid(c.section_group_id) &&
            ['Professor', 'TA', 'Student'].includes(c.role),
        ),
    );
  }

  /** null only on a 404 whose body is {error:'not found'} */
  async getRoster(id: string): Promise<RosterResponse | null> {
    if (!isGid(id)) {
      return Promise.reject(
        new KhouryAdminError('getRoster needs an sg_ + 18 digit group id'),
      );
    }
    return this.get(
      `/api/v1/section-groups/${enc(id)}/roster`,
      (d) =>
        d.id === id &&
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
    const url =
      String(this.config.get('KHOURY_ADMIN_URL')).replace(/\/+$/, '') + path;
    // NOTE: no default; an unset token must fail before any request is sent. The token is never put in a message.
    const token = String(this.config.get('KHOURY_ADMIN_TOKEN') ?? '').trim();
    if (!token) {
      throw new KhouryAdminError('KHOURY_ADMIN_TOKEN is not configured');
    }
    let res;
    try {
      res = await firstValueFrom(
        this.http.get(url, {
          headers: { Authorization: `Token ${token}` },
          timeout: 5000,
          maxRedirects: 0,
          validateStatus: () => true,
        }),
      );
    } catch (e) {
      // NOTE: never let the token reach an error message, whatever the transport put in it
      const msg = String(e?.message ?? e)
        .split(token)
        .join('[redacted]');
      throw new KhouryAdminError(`Khoury Admin request failed: ${msg}`);
    }
    // NOTE: only the agreed not-found body means "group gone"; any other 404 is a failure
    const d404 = res.data;
    if (
      nullOn404 &&
      res.status === 404 &&
      d404 &&
      typeof d404 === 'object' &&
      !Array.isArray(d404) &&
      Object.keys(d404).length === 1 &&
      d404.error === 'not found'
    ) {
      return null;
    }
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
