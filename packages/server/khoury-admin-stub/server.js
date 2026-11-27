// Dev-only fake Khoury Admin. Plain node, no deps. Never run in production.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MISSING = Symbol('missing');

function createStubServer(dataDir, opts = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Khoury Admin stub must never run in production');
  }
  const send = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const readJson = (...parts) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dataDir, ...parts), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return MISSING;
      throw e; // corrupt/unreadable fixture is an error, not absence
    }
  };
  // Khoury Admin knows both aliases of an address
  const norm = (e) =>
    e.toLowerCase().replace(/@husky\.neu\.edu$/, '@northeastern.edu');

  return http.createServer((req, res) => {
    // NOTE: checked before any route or file lookup; opts.token lets tests use a token other than the env one
    // NOTE: each source is trimmed like the client trims its token. The dev fallback is stub-only; the client refuses a blank token.
    const t = (v) => String(v ?? '').trim();
    const expected =
      t(opts.token) ||
      t(process.env.KHOURY_ADMIN_TOKEN) ||
      'dev-khoury-admin-token';
    if (req.headers.authorization !== `Token ${expected}`) {
      return send(res, 401, { error: 'unauthorized' });
    }
    let url, kind, key, leaf;
    // NOTE: exact route from the raw path (before any URL normalization), static segments undecoded
    const m =
      /^\/api\/v1\/(instructors|users|section-groups)\/([^/]+)\/(section-groups|courses|roster)$/;
    let exact = false;
    try {
      url = new URL(req.url, 'http://stub');
      // NOTE: URLSearchParams tolerates bad escapes, so validate the raw query too
      req.url
        .split('?')
        .slice(1)
        .join('?')
        .split('&')
        .forEach((q) => decodeURIComponent(q));
      const g = m.exec(req.url.split('?')[0]);
      if (g) {
        [kind, , leaf] = g.slice(1);
        key = decodeURIComponent(g[2]);
      }
      exact =
        !!g &&
        req.method === 'GET' &&
        !req.url.includes('#') &&
        key !== '.' &&
        key !== '..';
    } catch {
      return send(res, 400, { error: 'bad request' });
    }
    const semester = url.searchParams.get('semester');
    // keep path traversal out of the filesystem lookups
    const safe = (s) => s && !/[\\/]|\.\./.test(s);

    const go = () => {
      try {
        route();
      } catch {
        send(res, 500, { error: 'stub data error' });
      }
    };
    const route = () => {
      if (opts.fail === '500') return send(res, 500, { error: 'forced' });
      if (opts.fail === 'badshape')
        return send(res, 200, { semester: '202710' });

      if (!exact) return send(res, 404, { error: 'no such route' });
      if (
        kind === 'instructors' &&
        leaf === 'section-groups' &&
        safe(key) &&
        safe(semester)
      ) {
        const d = readJson(semester, 'instructors', `${norm(key)}.json`);
        return send(
          res,
          200,
          d === MISSING ? { semester, section_groups: [] } : d,
        );
      }
      if (
        kind === 'users' &&
        leaf === 'courses' &&
        safe(key) &&
        safe(semester)
      ) {
        if (!url.searchParams.get('nuid')) {
          return send(res, 400, { error: 'nuid required' });
        }
        const d = readJson(semester, 'users', `${norm(key)}.json`);
        return send(res, 200, d === MISSING ? { semester, courses: [] } : d);
      }
      if (kind === 'section-groups' && leaf === 'roster' && safe(key)) {
        const suffix = opts.rosterSuffix || '';
        let d = readJson('rosters', `${key}${suffix}.json`);
        // NOTE: groups without a variant file keep their base roster
        if (d === MISSING && suffix) d = readJson('rosters', `${key}.json`);
        return d === MISSING
          ? send(res, 404, { error: 'not found' })
          : send(res, 200, d);
      }
      send(res, 404, { error: 'no such route' });
    };

    // 'slow' never answers within the client's 5s timeout
    if (opts.fail === 'slow') return void setTimeout(go, 10000).unref();
    go();
  });
}

module.exports = { createStubServer };

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Khoury Admin stub must never run in production');
    process.exit(1);
  }
  const port = Number(process.env.KHOURY_STUB_PORT || 4100);
  createStubServer(path.join(__dirname, 'data'), {
    fail: process.env.KHOURY_STUB_FAIL,
  }).listen(port, () => console.log(`Khoury Admin stub on :${port}`));
}
