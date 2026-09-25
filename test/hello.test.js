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
// Every request also carries a deadline (see `fetchWithDeadline` below), so a
// server that never answers makes a test fail instead of leaving `npm test`
// hanging.

import { test, before, after } from 'node:test';
// The `strict` flavour of `node:assert` makes `assert.equal(actual, expected)`
// compare with `===`, so the string '11' and the number 11 count as different.
import assert from 'node:assert/strict';
// The `.js` extension is required: ES modules import files by their full name.
import { createServer, HOST } from '../src/server.js';

// How long one request may take before the test that sent it gives up:
// 5000 milliseconds, which is 5 seconds.
//
// A request needs a deadline because `fetch` on its own keeps waiting for an
// answer that never comes, for minutes. If a change to the router ever left a
// request unanswered, which is the exact mistake the 404 tests below guard
// against (see Step 3 in src/server.js), `npm test` would hang instead of
// failing. With a deadline, that request is abandoned, `fetch` rejects with a
// `TimeoutError`, and the test that sent it fails with that error.
//
// Why 5 seconds: the server runs on this machine and answers in a few
// milliseconds, so a real answer never comes close to the deadline. The wide
// margin keeps a slow or busy computer from failing a test that is passing.
const REQUEST_TIMEOUT_MS = 5000;

// The server under test and the address it listens on. `before()` below sets
// both once, before the first test runs, which is why they are `let` rather
// than `const`.
let server;
let baseUrl;

/**
 * Sends one request to the server under test, with a deadline.
 *
 * It works like `fetch` and returns the same response, with two differences:
 * it puts the server's address in front of `path` for you, and it gives the
 * request a deadline of REQUEST_TIMEOUT_MS. `AbortSignal.timeout(ms)`, built
 * into Node.js, creates a signal that cancels the request once `ms`
 * milliseconds have passed, and `fetch` watches the signal it is given. Every
 * call creates a fresh signal, so each request gets its own full 5 seconds.
 *
 * This is a deadline, not a pause and not a second attempt. Nothing waits: a
 * request answered in 3 milliseconds finishes in 3 milliseconds, and a
 * deadline that is never reached does not delay the end of the run. Nothing
 * is retried either: a request that misses its deadline is not sent again,
 * it rejects with a `TimeoutError` and fails the test.
 *
 * A new test, for example for a second route, gets the same protection by
 * sending its requests through this function too.
 *
 * @example
 * const res = await fetchWithDeadline('/hello', { method: 'HEAD' });
 *
 * @param {string} path Everything after the address: the path and, if there
 *   is one, the query string, such as `/hello?name=ada`. It is sent exactly as
 *   written.
 * @param {RequestInit} [options] The usual `fetch` options, such as
 *   `{ method: 'POST' }`. Any `signal` in them is replaced by the deadline.
 * @returns {Promise<Response>} The server's response.
 */
function fetchWithDeadline(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

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
//
// That `error` listener is temporary: it exists only while listening is
// pending, so the callback removes it with `server.off` before resolving.
// `once` alone would not do this, because it removes a listener only after
// its own event fires. Left attached, the listener would catch any later
// server error and pass it to `reject`, which does nothing on a Promise that
// has already resolved, so the error would vanish and the tests would still
// pass. With the listener gone, a later server error has nothing to catch
// it, so it surfaces as an unhandled error and fails the run.
before(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });

  // `server.address()` reports where the server is actually listening,
  // including the port the operating system picked for it.
  const { port } = server.address();
  baseUrl = `http://${HOST}:${port}`;
});

// `after()` runs once, after every test in this file has finished. It runs
// even when `before()` failed, which is why it first checks that there is a
// listening server to close.
//
// A listening server keeps the Node.js process alive, waiting for the next
// connection, so the test run would never end on its own. Closing the server
// lets the test process exit. `server.close` stops accepting connections and
// calls its callback once the open ones have ended; the Promise makes
// `after()` wait for that, and reports a failure to close as an error.
//
// `server.close` ends idle connections itself, but it waits for any
// connection that is still busy with a request. By the time `after()` runs,
// every test is done, so a connection that is still open is either idle,
// kept open for a next request that will never come, or holds a request
// that a failed test left behind. `server.closeAllConnections()` closes them
// all at once, so teardown finishes straight away instead of waiting on a
// stalled request.
after(async () => {
  // When `before()` failed, there is no listening server to close: either
  // `createServer()` never returned, so `server` was never set, or `listen`
  // failed. `server?.listening` is false or `undefined` in both cases (`?.`
  // gives `undefined` instead of throwing when `server` is not set). Closing
  // anyway would add a second error, `ERR_SERVER_NOT_RUNNING` or a
  // `TypeError`, on top of the real one, so the hook returns early and the
  // setup failure stays the only error reported.
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeAllConnections();
  });
});

// GET is what a browser or a plain `curl` sends. This test checks all three
// parts of the answer: the status code, the two headers the handler sets,
// and the body, byte for byte.
test('GET /hello returns the greeting', async () => {
  const res = await fetchWithDeadline('/hello');

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
  const res = await fetchWithDeadline('/hello', { method: 'HEAD' });

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
  const withQuery = await fetchWithDeadline('/hello?name=ada');
  assert.equal(withQuery.status, 200, 'expected 200 for /hello?name=ada');
  assert.equal(
    await withQuery.text(),
    'Hello world',
    'expected the greeting for /hello?name=ada',
  );

  for (const path of ['/hello/', '/HELLO', '/']) {
    const res = await fetchWithDeadline(path);
    // The message names the path, so a failure says which one went wrong.
    assert.equal(res.status, 404, 'expected 404 for ' + path);
    // Only the status matters here, but the body is read anyway: a response
    // holds on to its connection until its body has been read, so reading it
    // frees the connection for the next request instead of leaving it tied up.
    await res.text();
  }
});

// Every path other than /hello is answered with a plain-text 404, so no
// client is ever left waiting on a request the router does not recognise.
test('An unknown path is not found', async () => {
  const res = await fetchWithDeadline('/goodbye');
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
  const malformed = await fetchWithDeadline('//%zz/x');
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
  const res = await fetchWithDeadline('/hello', { method: 'POST' });

  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
  assert.equal(await res.text(), 'Method Not Allowed');
});
