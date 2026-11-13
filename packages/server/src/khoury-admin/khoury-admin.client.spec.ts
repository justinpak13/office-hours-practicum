import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import { AddressInfo } from 'net';
import * as path from 'path';
import { of } from 'rxjs';
import { KhouryAdminClient } from './khoury-admin.client';
import { KhouryAdminError } from './khoury-admin.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createStubServer } = require('../../khoury-admin-stub/server');
const dataDir = path.join(__dirname, '../../khoury-admin-stub/data');

async function listen(opts?: Record<string, string>, dir = dataDir) {
  const server = createStubServer(dir, opts);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port as number };
}

describe('KhouryAdminClient', () => {
  const client = new KhouryAdminClient(new HttpService(), new ConfigService());
  const servers: any[] = [];
  const point = async (opts?: Record<string, string>) => {
    const s = await listen(opts);
    servers.push(s.server);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${s.port}`;
  };
  afterAll(() => servers.forEach((s) => s.close()));

  it('A returns section groups for prof.a', async () => {
    await point();
    const res = await client.getSectionGroups(
      'prof.a@northeastern.edu',
      '202710',
    );
    expect(res.section_groups.map((g) => g.id)).toEqual(['sg_1001', 'sg_1002']);
  });

  it('B returns [] for an unknown person', async () => {
    await point();
    const res = await client.getCourses('nobody@northeastern.edu', '202710');
    expect(res.courses).toEqual([]);
  });

  it('C returns null for sg_9999', async () => {
    await point();
    expect(await client.getRoster('sg_9999')).toBeNull();
  });

  it('throws KhouryAdminError on fail 500', async () => {
    await point({ fail: '500' });
    await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  });

  it('throws KhouryAdminError on badshape', async () => {
    await point({ fail: 'badshape' });
    await expect(
      client.getCourses('doe.j@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
  });

  it('throws KhouryAdminError on a bad generated_at', async () => {
    await point();
    const svc = new HttpService();
    jest.spyOn(svc, 'get').mockReturnValue(
      of({
        status: 200,
        data: {
          id: 'sg_1001',
          name: 'x',
          semester: '202710',
          generated_at: 'not-a-date',
          professors: [],
          tas: [],
          sections: [],
        },
      } as any),
    );
    const c = new KhouryAdminClient(svc, new ConfigService());
    await expect(c.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  });

  it('throws KhouryAdminError on a bad role or malformed person', async () => {
    const svc = new HttpService();
    const get = jest.spyOn(svc, 'get');
    const c = new KhouryAdminClient(svc, new ConfigService());
    get.mockReturnValue(
      of({
        status: 200,
        data: {
          semester: '202710',
          courses: [{ section_group_id: 'sg_1', role: 'Admin' }],
        },
      } as any),
    );
    await expect(
      c.getCourses('a@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
    get.mockReturnValue(
      of({
        status: 200,
        data: {
          id: 'sg_1',
          name: 'x',
          semester: '202710',
          generated_at: '2026-09-01T12:00:00Z',
          professors: [],
          tas: [],
          sections: [{ crn: 1, students: [{ email: 1 }] }],
        },
      } as any),
    );
    await expect(c.getRoster('sg_1')).rejects.toBeInstanceOf(KhouryAdminError);
  });

  it('survives a malformed percent-encoded URL', async () => {
    const { server, port } = await listen();
    servers.push(server);
    const bad = await new Promise<number>((resolve, reject) =>
      http
        .get(
          { host: '127.0.0.1', port, path: '/api/v1/users/%E0%A4%A/courses' },
          (r) => {
            r.resume();
            resolve(r.statusCode as number);
          },
        )
        .on('error', reject),
    );
    expect(bad).toBe(400);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${port}`;
    expect((await client.getRoster('sg_1001'))?.id).toBe('sg_1001');
  });

  it('resolves husky.neu.edu aliases case-insensitively', async () => {
    await point();
    const b = await client.getCourses('Doe.J@Husky.NEU.edu', '202710');
    expect(b.courses.map((c) => c.section_group_id)).toEqual(['sg_1001']);
    const a = await client.getSectionGroups('PROF.A@husky.neu.edu', '202710');
    expect(a.section_groups.map((g) => g.id)).toEqual(['sg_1001', 'sg_1002']);
  });

  it('answers 500 for corrupt fixtures instead of treating them as absent', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-'));
    try {
      fs.mkdirSync(path.join(dir, '202710/instructors'), { recursive: true });
      fs.mkdirSync(path.join(dir, '202710/users'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'rosters'));
      fs.writeFileSync(
        path.join(dir, '202710/instructors/x@northeastern.edu.json'),
        '{oops',
      );
      fs.writeFileSync(
        path.join(dir, '202710/users/x@northeastern.edu.json'),
        '{oops',
      );
      fs.writeFileSync(path.join(dir, 'rosters/sg_x.json'), '{oops');
      const s = await listen(undefined, dir);
      servers.push(s.server);
      process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${s.port}`;
      await expect(
        client.getSectionGroups('x@northeastern.edu', '202710'),
      ).rejects.toBeInstanceOf(KhouryAdminError);
      await expect(
        client.getCourses('x@northeastern.edu', '202710'),
      ).rejects.toBeInstanceOf(KhouryAdminError);
      await expect(client.getRoster('sg_x')).rejects.toBeInstanceOf(
        KhouryAdminError,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(['null', 'false', '0', '""'])(
    'treats fixture content %s as an error, not absence',
    async (content) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-'));
      try {
        fs.mkdirSync(path.join(dir, '202710/instructors'), { recursive: true });
        fs.mkdirSync(path.join(dir, '202710/users'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'rosters'));
        fs.writeFileSync(
          path.join(dir, '202710/instructors/x@northeastern.edu.json'),
          content,
        );
        fs.writeFileSync(
          path.join(dir, '202710/users/x@northeastern.edu.json'),
          content,
        );
        fs.writeFileSync(path.join(dir, 'rosters/sg_x.json'), content);
        const s = await listen(undefined, dir);
        servers.push(s.server);
        process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${s.port}`;
        await expect(
          client.getSectionGroups('x@northeastern.edu', '202710'),
        ).rejects.toBeInstanceOf(KhouryAdminError);
        await expect(
          client.getCourses('x@northeastern.edu', '202710'),
        ).rejects.toBeInstanceOf(KhouryAdminError);
        await expect(client.getRoster('sg_x')).rejects.toBeInstanceOf(
          KhouryAdminError,
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it('normalizes the email in outgoing A/B requests', async () => {
    const urls: string[] = [];
    const rec = http.createServer((req, res) => {
      urls.push(req.url as string);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ semester: '202710', section_groups: [], courses: [] }),
      );
    });
    await new Promise<void>((r) => rec.listen(0, '127.0.0.1', r));
    servers.push(rec);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${
      (rec.address() as AddressInfo).port
    }`;
    await client.getSectionGroups('DOE.J@HUSKY.NEU.EDU', '202710');
    await client.getCourses('DOE.J@HUSKY.NEU.EDU', '202710');
    expect(urls).toHaveLength(2);
    urls.forEach((u) => expect(u).toContain('doe.j%40northeastern.edu'));
  });

  it('refuses to be created in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => createStubServer(dataDir)).toThrow();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('throws KhouryAdminError when the server is down', async () => {
    process.env.KHOURY_ADMIN_URL = 'http://127.0.0.1:1';
    await expect(
      client.getSectionGroups('prof.a@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
  });
});
