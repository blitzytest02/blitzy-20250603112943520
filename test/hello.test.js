// test/hello.test.js - automated tests for the /hello endpoint.
//
// These five tests prove the whole contract of this tutorial's one endpoint.
// They start a real server, send it real HTTP requests and check the answers:
//
// 1. GET /hello answers 200 with exactly `Hello world` and the right headers.
// 2. HEAD /hello answers with the same status and headers, but no body.
// 3. Path matching is exact: a query string still matches, while `/hello/`,
//    `/HELLO` and `/` do not.
// 4. Any other path the router receives is answered 404 Not Found, whatever
//    the method (GET, POST, PUT and DELETE are sent), and so is a malformed
//    one the URL parser cannot read, such as `//%zz/x`. Node itself answers
//    400 to a request its HTTP parser rejects, before any routing. A CONNECT
//    request whose target is a host and port, not /hello, is answered 404
//    too.
// 5. A method other than GET or HEAD on /hello is answered 405: POST, PUT,
//    DELETE, PATCH and OPTIONS, and CONNECT too, which Node hands to a
//    separate listener.
//
// Nothing needs to be installed to run them. `node:test` (the test runner),
// `node:assert` (the checks) and `node:net` (plain network connections) are
// modules built into Node.js, and `fetch` (the HTTP client) is a global that
// Node provides to every module, just as a browser does. `fetch` refuses to
// send CONNECT, so the two CONNECT requests go through `rawRequest` below,
// which writes them out by hand over a `node:net` connection. `npm test`
// runs `node --test`, which finds this file on its own because it lives in
// the `test/` directory, so no configuration file is needed either.
//
// Between them, the five tests check the three parts of a response that any
// HTTP client sees, each where the contract defines it:
// - the status code, in every test;
// - the headers that matter, where they matter: `Content-Type` and
//   `Content-Length` for GET and HEAD /hello, `Content-Type` for the 404s
//   in 'An unknown path is not found' and for the 405s, and `Allow` for the
//   405s;
// - the body: `Hello world`, the empty body of a HEAD response, `Not Found`
//   and `Method Not Allowed`.
// Reading a body is not the same as checking it: for `/hello/`, `/HELLO`
// and `/`, 'Path matching is exact' checks only the status code, and reads
// each body just to free the connection. If you change a part that is
// checked, a test fails with a message that says what differed. A part no
// test checks, such as the `Content-Length` of a 404, can change without
// failing any test.
//
// Every request also carries a deadline (see `fetchWithDeadline` and
// `rawRequest` below), so a server that never answers, stops partway through
// a body, or never closes a CONNECT connection, makes a test fail instead of
// leaving `npm test` hanging.

import { test, before, after } from 'node:test';
// The `strict` flavour of `node:assert` makes `assert.equal(actual, expected)`
// the same function as `assert.strictEqual`: it never converts one type into
// another, so the string '11' and the number 11 count as different. It
// compares the way `Object.is` does, which matches `===` except in two
// cases: `NaN` counts as equal to `NaN`, and `0` and `-0` count as different.
import assert from 'node:assert/strict';
// `node:net` opens plain network connections. `rawRequest` below uses it for
// the one kind of request `fetch` refuses to send, CONNECT.
import net from 'node:net';
// The `.js` extension is required: ES modules import files by their full name.
import { createServer, HOST } from '../src/server.js';

// How long one request may take before the test that sent it gives up:
// 5000 milliseconds, which is 5 seconds.
//
// A request needs a deadline because `fetch` on its own keeps waiting for an
// answer that never comes, for minutes. If a change to the router ever left a
// request unanswered, which is the exact mistake the 404 tests below guard
// against (see Step 3 in src/server.js), `npm test` would hang instead of
// failing. With a deadline, that request is abandoned once the time is up,
// and which step fails depends on how far the answer had got by then:
// - if the response headers have not arrived yet, `fetch` itself rejects
//   with a `TimeoutError`;
// - if the headers did arrive, `fetch` has already resolved with the
//   response, so it is reading the body (`await res.text()`) that rejects
//   with the `TimeoutError` instead.
// Either way, the test that is waiting on that step fails with that error.
// `rawRequest`, further down, gives the connections it opens the same
// deadline.
//
// Why 5 seconds: the server runs on this machine and answers in a few
// milliseconds, so a real answer never comes close to the deadline. The wide
// margin keeps a slow or busy computer from failing a test that is passing.
const REQUEST_TIMEOUT_MS = 5000;

// The server under test, the port it listens on and its full address.
// `before()` below sets all three once, before the first test runs, which is
// why they are `let` rather than `const`.
let server;
let port;
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
 * is retried either: a request that misses its deadline is not sent again.
 * The deadline covers the whole exchange, so which Promise rejects with the
 * `TimeoutError` depends on when it expires: the one this function returns,
 * if the response headers have not arrived yet, or the one from reading the
 * body, such as `res.text()`, if they have. Either way, the test fails.
 *
 * A new test, for example for a second route, gets the same protection by
 * sending its requests through this function too.
 *
 * @example
 * const res = await fetchWithDeadline('/hello', { method: 'HEAD' });
 *
 * @param {string} path Everything after the address: the path and, if there
 *   is one, the query string, such as `/hello?name=ada`. It is appended to
 *   the server's address, and `fetch` parses the result as a URL before
 *   sending it, so what reaches the server can differ from what is written
 *   here: dot segments are resolved (`/a/../hello` is sent as `/hello`), and
 *   characters a URL cannot hold are percent-encoded (a space becomes `%20`).
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

/**
 * Sends one request, written out as raw text, over a plain network
 * connection with a deadline, and returns the server's answer split into its
 * parts.
 *
 * `fetch` cannot send every request. The Fetch standard, which the `fetch`
 * in Node.js follows, forbids the CONNECT method, so `fetch` rejects with a
 * `TypeError` before anything is sent. This function works one level lower.
 * `net.connect` opens a TCP connection to the server under test, the same
 * kind of connection `fetch` and curl open underneath, and an HTTP request is
 * simply text written on it. The function writes `requestText` exactly as
 * given, collects every byte the server sends back until the server closes
 * its side of the connection, and splits the result the way `curl -i` shows
 * it: the status line, the headers, an empty line, and the body.
 *
 * It carries the same deadline as fetchWithDeadline. `net.connect` watches
 * the `signal` it is given: once REQUEST_TIMEOUT_MS have passed, it destroys
 * the connection, and the Promise returned here rejects with an `AbortError`
 * whose `cause` is the `TimeoutError`. So a server that never answers, or
 * answers but never closes the connection, makes the test fail instead of
 * hanging. A connection that is refused or reset rejects the Promise too,
 * with that error.
 *
 * @example
 * const res = await rawRequest('CONNECT /hello HTTP/1.1\r\nHost: x\r\n\r\n');
 * // res.statusLine is 'HTTP/1.1 405 Method Not Allowed'
 *
 * @param {string} requestText The complete request: the request line, then
 *   one line per header, then an empty line. HTTP ends every one of those
 *   lines with `\r\n` (carriage return and line feed), not just `\n`.
 * @returns {Promise<{statusLine: string, headers: Map<string, string>,
 *   body: string}>} The response. `headers` maps each header name, in lower
 *   case, to its value, so `headers.get('allow')` reads a header the way
 *   `res.headers.get('allow')` does on a `fetch` response. If the server
 *   closed the connection without sending anything, every part is empty:
 *   `statusLine` is `''`, so the test's check of the status line fails and
 *   says so.
 */
function rawRequest(requestText) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({
      host: HOST,
      port,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const chunks = [];

    socket.on('error', reject);
    socket.on('data', (chunk) => chunks.push(chunk));

    // 'end' fires once the server has closed its side of the connection, so
    // by then every byte of its answer has arrived. The headers end at the
    // first empty line, `\r\n\r\n`; everything after it is the body.
    socket.on('end', () => {
      const [head, ...bodyParts] = Buffer.concat(chunks)
        .toString()
        .split('\r\n\r\n');
      const [statusLine, ...headerLines] = head.split('\r\n');
      const headers = new Map(
        headerLines.map((line) => {
          const colon = line.indexOf(':');
          return [
            line.slice(0, colon).toLowerCase(),
            line.slice(colon + 1).trim(),
          ];
        }),
      );
      resolve({ statusLine, headers, body: bodyParts.join('\r\n\r\n') });
    });

    socket.write(requestText);
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
  port = server.address().port;
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
// stalled request. A CONNECT connection is the one kind it cannot reach:
// Node stops keeping track of a connection once it hands it to the 'connect'
// listener, which is why that listener in src/server.js closes it itself.
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
// - the router adds no normalization of its own to the path the URL parser
//   gives it: no trailing slash is removed and no letter case is changed, so
//   `/hello/` and `/HELLO` are different paths, and so is the root `/`.
// The URL parser itself does tidy a few things before that comparison, such
// as resolving dot segments (`/x/../hello` becomes `/hello`), but that is
// part of reading a URL, not a rule this router adds.
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
//
// The router looks at the path first, and only /hello goes on to have its
// method checked, so an unknown path is a 404 whatever the method. The test
// sends GET and three other methods to the same unknown path to hold the
// router to that order: a router that checked the method before the path
// would answer POST, PUT and DELETE here with a 405 instead.
test('An unknown path is not found', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const res = await fetchWithDeadline('/goodbye', { method });

    // Each message names the method, so a failure says which one went wrong.
    assert.equal(res.status, 404, `expected 404 for ${method} /goodbye`);
    assert.equal(
      res.headers.get('content-type'),
      'text/plain; charset=utf-8',
      `expected text/plain for ${method} /goodbye`,
    );
    assert.equal(
      await res.text(),
      'Not Found',
      `expected Not Found for ${method} /goodbye`,
    );
  }

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

  // A CONNECT request gets a 404 too, when its target is not /hello.
  //
  // CONNECT asks a proxy to open a tunnel to another server, and its usual
  // target is that server's host and port, such as `127.0.0.1:3000`, rather
  // than a path. Node hands CONNECT to the server's separate 'connect'
  // listener in src/server.js, not to the request listener, and that
  // listener answers such a target with the same 404. `fetch` cannot send
  // CONNECT, so `rawRequest` writes the request out by hand; here it asks
  // for a tunnel to the server under test itself.
  const authority = `${HOST}:${port}`;
  const connect = await rawRequest(
    `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`,
  );
  assert.equal(
    connect.statusLine,
    'HTTP/1.1 404 Not Found',
    'expected 404 for CONNECT ' + authority,
  );
  assert.equal(
    connect.headers.get('content-type'),
    'text/plain; charset=utf-8',
    'expected text/plain for CONNECT ' + authority,
  );
  assert.equal(
    connect.body,
    'Not Found',
    'expected Not Found for CONNECT ' + authority,
  );
});

// /hello answers only GET and HEAD. Any other method, such as POST, is
// refused with 405 Method Not Allowed instead of a misleading success, and
// the `Allow` header tells the client which methods would work.
//
// The test sends five different methods rather than POST alone, because the
// rule is "everything except GET and HEAD", not "POST". A handler that
// refused only the methods it had heard of, for example one that checked
// `req.method === 'POST'`, would pass a POST-only test while answering PUT,
// DELETE, PATCH and OPTIONS with a 200 and the greeting.
test('An unsupported method is rejected', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await fetchWithDeadline('/hello', { method });

    // Each message names the method, so a failure says which one went wrong.
    assert.equal(res.status, 405, `expected 405 for ${method} /hello`);
    assert.equal(
      res.headers.get('allow'),
      'GET, HEAD',
      `expected Allow: GET, HEAD for ${method} /hello`,
    );
    assert.equal(
      res.headers.get('content-type'),
      'text/plain; charset=utf-8',
      `expected text/plain for ${method} /hello`,
    );
    assert.equal(
      await res.text(),
      'Method Not Allowed',
      `expected Method Not Allowed for ${method} /hello`,
    );
  }

  // CONNECT is refused the same way, even though it takes a different path
  // through the server. Node never hands CONNECT to the request listener,
  // so helloHandler never sees it: the separate 'connect' listener in
  // src/server.js answers it, and then closes the connection. `fetch`
  // cannot send CONNECT, so `rawRequest` writes the request out by hand.
  const connect = await rawRequest(
    `CONNECT /hello HTTP/1.1\r\nHost: ${HOST}:${port}\r\n\r\n`,
  );
  assert.equal(
    connect.statusLine,
    'HTTP/1.1 405 Method Not Allowed',
    'expected 405 for CONNECT /hello',
  );
  assert.equal(
    connect.headers.get('allow'),
    'GET, HEAD',
    'expected Allow: GET, HEAD for CONNECT /hello',
  );
  assert.equal(
    connect.headers.get('content-type'),
    'text/plain; charset=utf-8',
    'expected text/plain for CONNECT /hello',
  );
  assert.equal(
    connect.body,
    'Method Not Allowed',
    'expected Method Not Allowed for CONNECT /hello',
  );
});
