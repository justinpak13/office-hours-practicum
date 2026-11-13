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
    let url, seg;
    try {
      url = new URL(req.url, 'http://stub');
      seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      return send(res, 400, { error: 'bad request' });
    }
    const semester = url.searchParams.get('semester');
    // seg: api v1 <kind> <key> <leaf>
    const [, , kind, key, leaf] = seg;
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
        const d = readJson(semester, 'users', `${norm(key)}.json`);
        return send(res, 200, d === MISSING ? { semester, courses: [] } : d);
      }
      if (kind === 'section-groups' && leaf === 'roster' && safe(key)) {
        const d = readJson('rosters', `${key}${opts.rosterSuffix || ''}.json`);
        return d === MISSING
          ? send(res, 404, { error: 'not found' })
          : send(res, 200, d);
      }
      send(res, 404, { error: 'not found' });
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
