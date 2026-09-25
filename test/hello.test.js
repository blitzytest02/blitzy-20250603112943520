// test/hello.test.js - automated tests for the /hello endpoint.
//
// These five tests prove the whole contract of this tutorial's one endpoint.
// They start a real server, send it real HTTP requests and check the answers:
//
// 1. GET /hello answers 200 with exactly `Hello world` and the right headers.
// 2. HEAD /hello answers with the same status and headers, but no body.
// 3. Path matching is exact: a query string still matches, while `/hello/`,
//    `/HELLO` and `/` do not.
// 4. Any other path, even a malformed one, is answered 404 Not Found.
// 5. A method other than GET or HEAD on /hello is answered 405.
//
// Nothing needs to be installed to run them. `node:test` (the test runner)
// and `node:assert` (the checks) are modules built into Node.js, and `fetch`
// (the HTTP client) is a global that Node provides to every module, just as
// a browser does. `npm test` runs `node --test`, which finds this file on its
// own because it lives in the `test/` directory, so no configuration file is
// needed either.
//
// Each test reads a response the way any HTTP client would: the status code,
// the headers and the body. If you change what src/hello.js or src/server.js
// sends back, a test fails and its message tells you which part changed.

import { test, before, after } from 'node:test';
// The `strict` flavour of `node:assert` makes `assert.equal(actual, expected)`
// compare with `===`, so the string '11' and the number 11 count as different.
import assert from 'node:assert/strict';
// The `.js` extension is required: ES modules import files by their full name.
import { createServer, HOST } from '../src/server.js';

// The server under test and the address it listens on. `before()` below sets
// both once, before the first test runs, which is why they are `let` rather
// than `const`.
let server;
let baseUrl;

// `before()` runs once, before any test in this file.
//
// It creates the server with the same factory the real program uses and
// starts it listening on port 0. Port 0 is a special request: it asks the
// operating system for any port that is free right now. That is why these
// tests pass whether or not the app's usual port is taken, and why they never
// collide with a server you left running with `npm start`.
//
// The tests can choose their own port only because importing src/server.js
// does no work: `createServer()` hands back a server that is not listening
// yet, and whoever calls it decides where it listens.
//
// It listens on HOST, the same loopback address the app itself uses, so the
// tests reach the server exactly the way a learner's `curl` does.
//
// `server.listen` reports its outcome through a callback and events rather
// than a return value, so it is wrapped in a Promise that `await` can wait
// for. The callback runs once the server is ready for connections; an
// `error` event instead (listening failed) rejects the Promise, which fails
// the run with the real error.
before(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, resolve);
  });

  // `server.address()` reports where the server is actually listening,
  // including the port the operating system picked for it.
  const { port } = server.address();
  baseUrl = `http://${HOST}:${port}`;
});

// `after()` runs once, after every test in this file has finished.
//
// A listening server keeps the Node.js process alive, waiting for the next
// connection, so the test run would never end on its own. Closing the server
// lets the test process exit. `server.close` stops accepting connections and
// calls its callback once the open ones have ended; the Promise makes
// `after()` wait for that, and reports a failure to close as an error.
after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// GET is what a browser or a plain `curl` sends. This test checks all three
// parts of the answer: the status code, the two headers the handler sets,
// and the body, byte for byte.
test('GET /hello returns the greeting', async () => {
  const res = await fetch(`${baseUrl}/hello`);

  assert.equal(res.status, 200);
  // `res.headers.get` finds a header whatever its casing and returns its
  // value as a string, so the byte count is compared as '11', not 11.
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(res.headers.get('content-length'), '11');
  // `res.text()` reads the whole body. It must be exactly this string: that
  // casing, one space, no punctuation, no quotes and no trailing newline.
  assert.equal(await res.text(), 'Hello world');
});

// HEAD asks for the headers a GET would receive, without the body.
test('HEAD /hello returns headers only', async () => {
  const res = await fetch(`${baseUrl}/hello`, { method: 'HEAD' });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  // Node leaves out the body of a HEAD response automatically, but it still
  // sends `Content-Length: 11`: for HEAD, that header reports the size of the
  // body a GET would return.
  assert.equal(res.headers.get('content-length'), '11');
  assert.equal(await res.text(), '');
});

// The router compares the request's path with '/hello' exactly. Two
// consequences follow, and both are deliberate decisions rather than bugs:
// - the query string is not part of the path, so `/hello?name=ada` still
//   matches, and the query itself is never read;
// - nothing is normalized, so a trailing slash (`/hello/`) or different
//   letter casing (`/HELLO`) is a different path, and so is the root `/`.
test('Path matching is exact', async () => {
  const withQuery = await fetch(`${baseUrl}/hello?name=ada`);
  assert.equal(withQuery.status, 200, 'expected 200 for /hello?name=ada');
  assert.equal(
    await withQuery.text(),
    'Hello world',
    'expected the greeting for /hello?name=ada',
  );

  for (const path of ['/hello/', '/HELLO', '/']) {
    const res = await fetch(`${baseUrl}${path}`);
    // The message names the path, so a failure says which one went wrong.
    assert.equal(res.status, 404, 'expected 404 for ' + path);
    // Only the status matters here, but the body is read anyway: finishing
    // each response frees its connection, so `after()` can close the server
    // straight away instead of waiting for an unread response.
    await res.text();
  }
});

// Every path other than /hello is answered with a plain-text 404, so no
// client is ever left waiting on a request the router does not recognise.
test('An unknown path is not found', async () => {
  const res = await fetch(`${baseUrl}/goodbye`);
  assert.equal(res.status, 404, 'expected 404 for /goodbye');
  assert.equal(
    res.headers.get('content-type'),
    'text/plain; charset=utf-8',
    'expected text/plain for /goodbye',
  );
  assert.equal(
    await res.text(),
    'Not Found',
    'expected Not Found for /goodbye',
  );

  // A malformed request target gets a 404 too, not a crashed server.
  //
  // `fetch` sends the target `//%zz/x` exactly as written. The server's URL
  // parser reads a target that begins with two slashes as `//host/path`, and
  // `%zz` is not a valid host name, so the target cannot be parsed at all.
  // `new URL` would throw on it, and an error thrown inside the request
  // listener is caught by nothing, so it would stop the whole server. The
  // `URL.canParse` check in src/server.js asks the same question without
  // throwing, and the request falls through to the ordinary 404. This is the
  // only request in the suite that reaches that fallback.
  const malformed = await fetch(`${baseUrl}//%zz/x`);
  assert.equal(malformed.status, 404, 'expected 404 for //%zz/x');
  assert.equal(
    malformed.headers.get('content-type'),
    'text/plain; charset=utf-8',
    'expected text/plain for //%zz/x',
  );
  assert.equal(
    await malformed.text(),
    'Not Found',
    'expected Not Found for //%zz/x',
  );
});

// /hello answers only GET and HEAD. Any other method, such as POST, is
// refused with 405 Method Not Allowed instead of a misleading success, and
// the `Allow` header tells the client which methods would work.
test('An unsupported method is rejected', async () => {
  const res = await fetch(`${baseUrl}/hello`, { method: 'POST' });

  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
  assert.equal(await res.text(), 'Method Not Allowed');
});
