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

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { createStubServer } = require('../../khoury-admin-stub/server');
const dataDir = path.join(__dirname, '../../khoury-admin-stub/data');

async function listen(opts?: Record<string, string>, dir = dataDir) {
  const server = createStubServer(dir, opts);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port as number };
}

describe('KhouryAdminClient', () => {
  const auth = { Authorization: 'Token dev-khoury-admin-token' };
  const client = new KhouryAdminClient(new HttpService(), new ConfigService());
  const servers: any[] = [];
  beforeEach(() => {
    process.env.KHOURY_ADMIN_TOKEN = 'dev-khoury-admin-token';
  });
  const point = async (opts?: Record<string, string>) => {
    const s = await listen(opts);
    servers.push(s.server);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${s.port}`;
  };
  afterAll(() =>
    servers.forEach((s) => {
      s.close();
      s.closeAllConnections?.();
    }),
  );

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

  it('C throws on a 404 that is not the agreed not-found body', async () => {
    const srv = http.createServer((req, res) => {
      res.statusCode = 404;
      res.end('<html>nope</html>');
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    servers.push(srv);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${
      (srv.address() as AddressInfo).port
    }`;
    await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  });

  it('C throws when the base URL path is wrong', async () => {
    await point();
    process.env.KHOURY_ADMIN_URL += '/wrong';
    await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  });

  it('C throws on an empty id', async () => {
    await point();
    await expect(client.getRoster('')).rejects.toBeInstanceOf(KhouryAdminError);
  });

  it.each([
    ['GET', '/oops/v0/users/doe.j@northeastern.edu/courses?semester=202710'],
    ['GET', '/api/v1/users/doe.j@northeastern.edu/courses/?semester=202710'],
    ['GET', '//api/v1/users/doe.j@northeastern.edu/courses?semester=202710'],
    ['GET', '/api//v1/users/doe.j@northeastern.edu/courses?semester=202710'],
    ['GET', '/api/v1/section-groups//sg_1001/roster'],
    ['POST', '/api/v1/users/doe.j@northeastern.edu/courses?semester=202710'],
    ['GET', '/api/v1/users/x/roster'],
    ['GET', '/api/v1/instructors/x/courses'],
    ['GET', '/wrong/../api/v1/section-groups/sg_9999/roster'],
    ['GET', '/api/v1/section-groups/sg_9999/roster#extra'],
    ['GET', '/api/v1/%75sers/doe.j@northeastern.edu/courses?semester=202710'],
  ])('stub answers no such route for %s %s', async (method, p) => {
    const s = await listen();
    servers.push(s.server);
    const r = await new Promise<any>((resolve) =>
      http
        .request(
          { host: '127.0.0.1', port: s.port, method, path: p, headers: auth },
          (res) => {
            let b = '';
            res.on('data', (c) => (b += c));
            res.on('end', () => resolve({ status: res.statusCode, b }));
          },
        )
        .end(),
    );
    expect(r.status).toBe(404);
    expect(JSON.parse(r.b)).toEqual({ error: 'no such route' });
  });

  it('C throws on a 404 body with an extra field', async () => {
    const srv = http.createServer((req, res) => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ error: 'not found', upstream: 'proxy failure' }),
      );
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    servers.push(srv);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${
      (srv.address() as AddressInfo).port
    }`;
    await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  });

  it('stub answers 400 for a malformed percent escape in the query', async () => {
    const s = await listen();
    servers.push(s.server);
    const status = await new Promise<number>((resolve) =>
      http.get(
        {
          host: '127.0.0.1',
          port: s.port,
          path: '/api/v1/users/doe.j@northeastern.edu/courses?semester=%E0%A4%A',
          headers: auth,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode as number);
        },
      ),
    );
    expect(status).toBe(400);
  });

  it('C does not follow a redirect to a not-found roster', async () => {
    const s = await listen();
    servers.push(s.server);
    const redir = http.createServer((req, res) => {
      res.writeHead(302, {
        Location: `http://127.0.0.1:${s.port}/api/v1/section-groups/sg_9999/roster`,
      });
      res.end();
    });
    await new Promise<void>((r) => redir.listen(0, '127.0.0.1', r));
    servers.push(redir);
    process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${
      (redir.address() as AddressInfo).port
    }`;
    await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  });

  it('times out on a slow server with KhouryAdminError', async () => {
    await point({ fail: 'slow' });
    await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
  }, 10000);

  it('C throws on a whitespace-only id', async () => {
    await expect(client.getRoster('  ')).rejects.toBeInstanceOf(
      KhouryAdminError,
    );
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

  it('rejects an empty A group id and a padded B group id', async () => {
    const svc = new HttpService();
    const get = jest.spyOn(svc, 'get');
    const c = new KhouryAdminClient(svc, new ConfigService());
    get.mockReturnValue(
      of({
        status: 200,
        data: {
          semester: '202710',
          section_groups: [{ id: '', name: 'x', crns: [1] }],
        },
      } as any),
    );
    await expect(
      c.getSectionGroups('a@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
    get.mockReturnValue(
      of({
        status: 200,
        data: {
          semester: '202710',
          courses: [{ section_group_id: ' sg_1', role: 'TA' }],
        },
      } as any),
    );
    await expect(
      c.getCourses('a@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
  });

  it('rejects, not throws, on an email with a lone surrogate', async () => {
    const p = client.getCourses('a\uD800@northeastern.edu', '202710');
    await expect(p).rejects.toBeInstanceOf(KhouryAdminError);
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
          {
            host: '127.0.0.1',
            port,
            path: '/api/v1/users/%E0%A4%A/courses',
            headers: auth,
          },
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

  it('works when KHOURY_ADMIN_URL has a trailing slash', async () => {
    await point();
    process.env.KHOURY_ADMIN_URL += '//';
    expect((await client.getRoster('sg_1001'))?.id).toBe('sg_1001');
  });

  it('rejects a response whose semester differs from the request', async () => {
    const svc = new HttpService();
    const get = jest.spyOn(svc, 'get');
    const c = new KhouryAdminClient(svc, new ConfigService());
    get.mockReturnValue(
      of({
        status: 200,
        data: { semester: '202730', section_groups: [] },
      } as any),
    );
    await expect(
      c.getSectionGroups('a@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
    get.mockReturnValue(
      of({ status: 200, data: { semester: '202730', courses: [] } } as any),
    );
    await expect(
      c.getCourses('a@northeastern.edu', '202710'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
  });

  it('C rejects a response whose id differs from the request', async () => {
    const svc = new HttpService();
    jest.spyOn(svc, 'get').mockReturnValue(
      of({
        status: 200,
        data: {
          id: 'sg_other',
          name: 'x',
          semester: '202710',
          generated_at: '2026-09-01T12:00:00Z',
          professors: [],
          tas: [],
          sections: [],
        },
      } as any),
    );
    await expect(
      new KhouryAdminClient(svc, new ConfigService()).getRoster('sg_1001'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
  });

  it('C rejects an id with surrounding whitespace without a request', async () => {
    const svc = new HttpService();
    const get = jest.spyOn(svc, 'get');
    await expect(
      new KhouryAdminClient(svc, new ConfigService()).getRoster(' sg_1001'),
    ).rejects.toBeInstanceOf(KhouryAdminError);
    expect(get).not.toHaveBeenCalled();
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

  describe('token', () => {
    const record = async () => {
      const seen: (string | undefined)[] = [];
      const srv = http.createServer((req, res) => {
        seen.push(req.headers.authorization);
        res.statusCode = 500;
        res.end('{}');
      });
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      servers.push(srv);
      process.env.KHOURY_ADMIN_URL = `http://127.0.0.1:${
        (srv.address() as AddressInfo).port
      }`;
      return seen;
    };

    it('sends Authorization: Token <key> on A, B and C', async () => {
      const seen = await record();
      process.env.KHOURY_ADMIN_TOKEN = 'abc123';
      await client
        .getSectionGroups('a@northeastern.edu', '202710')
        .catch(() => 0);
      await client.getCourses('a@northeastern.edu', '202710').catch(() => 0);
      await client.getRoster('sg_1001').catch(() => 0);
      expect(seen).toEqual(Array(3).fill('Token abc123'));
    });

    it.each(['', '   ', undefined])(
      'fails without sending a request when the token is %p',
      async (v) => {
        const seen = await record();
        if (v === undefined) delete process.env.KHOURY_ADMIN_TOKEN;
        else process.env.KHOURY_ADMIN_TOKEN = v;
        await expect(client.getRoster('sg_1001')).rejects.toBeInstanceOf(
          KhouryAdminError,
        );
        expect(seen).toEqual([]);
      },
    );

    it('a wrong token gets 401 from the stub and fails', async () => {
      await point({ token: 'right' });
      process.env.KHOURY_ADMIN_TOKEN = 'wrong';
      const err = await client
        .getSectionGroups('prof.a@northeastern.edu', '202710')
        .catch((e) => e);
      expect(err).toBeInstanceOf(KhouryAdminError);
      expect(err.message).toContain('401');
      expect(err.message).not.toContain('wrong');
    });

    it('the stub rejects a missing header with 401 before any route', async () => {
      const s = await listen();
      servers.push(s.server);
      const r = await new Promise<any>((resolve) =>
        http.get(`http://127.0.0.1:${s.port}/nope`, (res) => {
          let b = '';
          res.on('data', (c) => (b += c));
          res.on('end', () => resolve({ status: res.statusCode, b }));
        }),
      );
      expect(r.status).toBe(401);
      expect(JSON.parse(r.b)).toEqual({ error: 'unauthorized' });
    });

    it('sends a padded token trimmed', async () => {
      const seen = await record();
      process.env.KHOURY_ADMIN_TOKEN = '  padded  ';
      await client.getRoster('sg_1001').catch(() => 0);
      expect(seen).toEqual(['Token padded']);
    });

    it('does not leak the token in a transport failure message', async () => {
      process.env.KHOURY_ADMIN_TOKEN = 'distinctive-secret-xyz';
      const svc = new HttpService();
      jest.spyOn(svc, 'get').mockImplementation(() => {
        throw new Error('boom Token distinctive-secret-xyz boom');
      });
      const c = new KhouryAdminClient(svc, new ConfigService());
      const err = await c.getRoster('sg_1001').catch((e) => e);
      expect(err).toBeInstanceOf(KhouryAdminError);
      expect(err.message).toContain('boom');
      expect(err.message).not.toContain('distinctive-secret-xyz');
    });

    it('the stub trims a padded env token', async () => {
      process.env.KHOURY_ADMIN_TOKEN = '  padded-env  ';
      expect(await raw('Token padded-env')).toBe(200);
    });

    const raw = async (authorization: string) => {
      const s = await listen();
      servers.push(s.server);
      return new Promise<number>((r) =>
        http.get(
          `http://127.0.0.1:${s.port}/api/v1/section-groups/sg_1001/roster`,
          { headers: { Authorization: authorization } },
          (res) => {
            res.resume();
            r(res.statusCode as number);
          },
        ),
      );
    };

    it('the stub rejects another token when its env token is set', async () => {
      process.env.KHOURY_ADMIN_TOKEN = 'env-token';
      expect(await raw('Token other')).toBe(401);
      expect(await raw('Token env-token')).toBe(200);
    });

    it('the stub falls back to the dev token when its env is unset', async () => {
      delete process.env.KHOURY_ADMIN_TOKEN;
      expect(await raw('Token dev-khoury-admin-token')).toBe(200);
    });

    it('reads the token on every call', async () => {
      const seen = await record();
      process.env.KHOURY_ADMIN_TOKEN = 'one';
      await client.getRoster('sg_1001').catch(() => 0);
      process.env.KHOURY_ADMIN_TOKEN = 'two';
      await client.getRoster('sg_1001').catch(() => 0);
      expect(seen).toEqual(['Token one', 'Token two']);
    });
  });
});
