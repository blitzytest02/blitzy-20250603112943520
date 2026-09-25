// src/server.js - builds the HTTP server and decides which code answers each
// request.
//
// This file is the middle link of a one-way chain:
//
//   src/index.js  -->  src/server.js  -->  src/hello.js
//   (starts it)        (routes it)         (answers /hello)
//
// It creates a server but never starts one. Importing this file opens no
// network socket, starts no timer and reads no environment variable: at the
// top level it only defines constants and a function. That is what lets the
// tests in test/hello.test.js create their own server and listen on port 0,
// which asks the operating system for any free port, so they never compete
// with a server you started yourself with `npm start`. Only src/index.js
// binds a real socket.

import http from 'node:http';
import { helloHandler } from './hello.js';

/**
 * The TCP port the server listens on when you do not choose one: 3000.
 *
 * This file only supplies the default. The override belongs to src/index.js,
 * which reads the `PORT` environment variable and falls back to this value
 * when `PORT` is not set to a positive whole number.
 */
export const DEFAULT_PORT = 3000;

/**
 * The address the server listens on: `127.0.0.1`, the loopback address.
 *
 * Loopback means "this computer only". A server bound here answers requests
 * that come from your own machine, and nothing else on your local network can
 * reach it. That is the right default for a tutorial server, so this value is
 * deliberately fixed: no environment variable can change it.
 */
export const HOST = '127.0.0.1';

// The fixed base URL used to turn a request target into a full URL.
//
// A request usually names only a path, such as `/hello?name=ada`, and the
// URL parser needs a complete address to resolve a path against. Any valid
// base works because we only ever read the path back out of the result. It is
// a constant rather than something built from the request's `Host` header on
// purpose: we do not need the host, and a `Host` value that Node's HTTP parser
// accepts can still be one the URL parser rejects. It is not exported: the
// public surface of this file is exactly DEFAULT_PORT, HOST and createServer.
const URL_BASE = 'http://localhost';

/**
 * Creates a new, configured, *unstarted* HTTP server for this tutorial.
 *
 * The server knows how to answer requests, but it opens no socket and listens
 * on nothing. The caller decides when and where it listens by calling
 * `server.listen(port, host)` itself: src/index.js uses `PORT` or
 * DEFAULT_PORT on HOST, while the tests use port 0 so the operating system
 * picks a free port for them.
 *
 * Every request gets an answer:
 * - a path of exactly `/hello` is handed to `helloHandler` in src/hello.js;
 * - every other path receives `404 Not Found`.
 *
 * @example
 * import { createServer, DEFAULT_PORT, HOST } from './server.js';
 *
 * const server = createServer(); // nothing is listening yet
 * server.listen(DEFAULT_PORT, HOST); // now it is
 *
 * @returns {http.Server} A server that has not been started yet.
 */
export function createServer() {
  // `http.createServer(listener)` builds a server around one function, the
  // request listener. Node calls that function once for every request that
  // arrives, and passes it two objects:
  // - `req` (an `http.IncomingMessage`) is what the client sent: the method,
  //   the URL and the headers;
  // - `res` (an `http.ServerResponse`) is what we send back: a status code,
  //   headers and a body.
  return http.createServer((req, res) => {
    // Step 1: work out which path the client asked for.
    //
    // `req.url` is the raw request target, and it includes the query string:
    // a request for `/hello?name=ada` has `req.url === '/hello?name=ada'`,
    // which would never equal '/hello'. Parsing it with `new URL` separates
    // the parts, and we keep only `.pathname`, which is '/hello' in that
    // example. The query string is never read.
    //
    // `new URL` throws an error when it cannot parse a target. Most targets
    // are plain paths that parse without trouble, but a client can also send
    // a full address such as `GET http://a:99999/hello` (port out of range),
    // which Node's HTTP parser lets through and the URL parser rejects. An
    // error thrown inside this listener is not caught by anything, so it
    // would stop the whole server, not just this one request. `URL.canParse`
    // asks the same question without throwing: when it answers false,
    // `pathname` is `false`, which matches no route, and the request gets the
    // ordinary 404 below. (Prefer `URL.canParse` to `URL.parse` here:
    // `URL.parse` needs Node.js 22.1.0, and this project supports every
    // release from 22.0.0.)
    const pathname =
      URL.canParse(req.url, URL_BASE) && new URL(req.url, URL_BASE).pathname;

    // Step 2: route the request.
    //
    // Matching is exact and case-sensitive, and that is a decision, not an
    // oversight: `/hello/` (trailing slash) and `/HELLO` are different paths
    // and receive 404. The early `return` stops here once /hello is answered.
    // One quirk of the URL standard is accepted as it is: a target that
    // starts with two slashes, such as `//example/hello`, is read as an
    // address on another host, so its path is `/hello` and it matches too.
    //
    // To add a second route, add one more `if` like this one that calls a
    // handler from its own module, next to src/hello.js.
    if (pathname === '/hello') {
      helloHandler(req, res);
      return;
    }

    // Step 3: answer everything else with 404 Not Found.
    //
    // This part is required, not optional. A listener that returns without
    // calling `res.end` sends nothing back, and the client sits waiting on an
    // open connection until it gives up. The headers follow the same rules as
    // src/hello.js: say the body is plain UTF-8 text, and say exactly how many
    // bytes it holds (`Buffer.byteLength` counts bytes, here 9).
    const body = 'Not Found';
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  });
}
