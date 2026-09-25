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
// top level it only defines constants and functions. That is what lets the
// tests in test/hello.test.js create their own server and listen on port 0,
// which asks the operating system for any free port, so they never compete
// with a server you started yourself with `npm start`. src/index.js alone
// binds the application's own listener, on PORT or DEFAULT_PORT; the tests
// bind short-lived sockets of their own, on ports the operating system picks.

import http from 'node:http';
import { helloHandler } from './hello.js';

/**
 * The TCP port the server listens on when you do not choose one: 3000.
 *
 * This file only supplies the default. The override belongs to src/index.js,
 * which reads the `PORT` environment variable with `Number.parseInt` and
 * falls back to this value when `PORT` is unset or the number read from it
 * is not a positive whole number.
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
// The request target is the address the client asked for, which Node hands
// the request listener as `req.url`. It is usually a relative URL such as
// `/hello?name=ada`, made of the pathname `/hello` and the query `?name=ada`,
// and the URL parser needs a complete address, the base, to resolve a
// relative URL against. Not every address works as that base: a `mailto:`
// address cannot have a relative URL resolved against it at all, and a base
// with a path of its own, such as `http://localhost/app/`, changes where a
// target that does not start with `/` lands. A web address with nothing after
// the host, such as `http://localhost`, is a suitable base: `/hello?name=ada`
// resolves against it to `http://localhost/hello?name=ada`, whose pathname is
// `/hello`. We only ever read the pathname back out of the result, so neither
// the host the base names nor the query is ever used. The base is a constant
// rather than something built from the request's `Host` header on purpose:
// we do not need the host, and a `Host` value that Node's HTTP parser accepts
// can still be one the URL parser rejects. It is not exported, and neither
// are the two helper functions below it: the public surface of this file is
// exactly DEFAULT_PORT, HOST and createServer.
const URL_BASE = 'http://localhost';

// Works out which path a request asks for, so that both listeners in
// createServer below can route on it. `target` is the raw request target,
// which Node hands the listeners as `req.url`. The function returns the
// pathname, such as '/hello', or `false` when the target cannot be parsed.
//
// `req.url` includes the query string: a request for `/hello?name=ada` has
// `req.url === '/hello?name=ada'`, which would never equal '/hello'. Parsing
// it with `new URL` separates the parts, and we keep only `.pathname`, which
// is '/hello' in that example. The query string is never read.
//
// `new URL` throws an error when it cannot parse a target. Most targets are
// plain paths that parse without trouble, but a client can also send a full
// address such as `GET http://a:99999/hello` (port out of range), which
// Node's HTTP parser lets through and the URL parser rejects. An error thrown
// inside a listener is not caught by anything, so it would stop the whole
// server, not just this one request. `URL.canParse` asks the same question
// without throwing: when it answers false, `&&` stops there and this function
// returns `false`, which matches no route, so the request gets the ordinary
// 404. (Prefer `URL.canParse` to `URL.parse` here: `URL.parse` needs Node.js
// 22.1.0, but the engines floor in package.json (`>=22.0.0`) admits 22.0.0
// too, so the router must work there. That floor is not the list of
// supported versions: the project supports and is tested on the two LTS
// lines, Node.js 24 and 22.)
function pathnameOf(target) {
  return URL.canParse(target, URL_BASE) && new URL(target, URL_BASE).pathname;
}

// Builds the complete text of a plain-text HTTP/1.1 response, exactly as it
// travels over the connection. The 'connect' listener in createServer below
// needs it, because it has no `res` object to do this work for it.
//
// Everywhere else, `res.writeHead(status, headers)` and `res.end(body)`
// produce this text for us. Spelled out, a response is:
// - the status line, such as `HTTP/1.1 404 Not Found`: the protocol version,
//   the status code, and the standard reason phrase for that code, which
//   Node keeps in `http.STATUS_CODES`;
// - one `Name: value` line for each header;
// - an empty line, which marks the end of the headers;
// - the body.
// HTTP ends each of those lines with two characters, `\r\n` (carriage return
// and line feed), not just `\n`, which is why the parts are joined with it.
// Nothing follows the body: `Content-Length` tells the client where it ends.
//
// `headers` holds the headers a caller would pass to `res.writeHead`, such as
// `{ Allow: 'GET, HEAD' }`, or `{}` for none. Every body built here is plain
// UTF-8 text, so this function always adds the same `Content-Type` and
// `Content-Length` headers that src/hello.js sets. It also adds the two that
// Node would otherwise add on its own: `Date`, the current time in the format
// HTTP uses, and `Connection: close`, which tells the client that the server
// closes the connection once this answer has been sent.
function plainTextResponse(status, headers, body) {
  const allHeaders = {
    ...headers,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    Date: new Date().toUTCString(),
    Connection: 'close',
  };
  const headerLines = Object.entries(allHeaders).map(
    ([name, value]) => `${name}: ${value}`,
  );

  return [
    `HTTP/1.1 ${status} ${http.STATUS_CODES[status]}`,
    ...headerLines,
    '',
    body,
  ].join('\r\n');
}

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
 * - every other path receives `404 Not Found`;
 * - a CONNECT request, which Node hands to a separate 'connect' listener
 *   instead of the request listener, is refused on the spot: `/hello`
 *   receives `405 Method Not Allowed`, anything else `404 Not Found`, and
 *   the connection is then closed.
 *
 * @example
 * import { createServer, DEFAULT_PORT, HOST } from './server.js';
 *
 * const server = createServer(); // nothing is listening yet
 *
 * // `listen` returns straight away and binds the port in the background, so
 * // the server is not ready yet on the line after it. Node calls the
 * // function passed last (a 'listening' event listener) once the socket is
 * // bound and the server accepts requests. If binding fails, for example
 * // with EADDRINUSE because another program holds the port, Node emits an
 * // 'error' event instead and never calls this function. src/index.js
 * // handles both outcomes this way.
 * server.listen(DEFAULT_PORT, HOST, () => {
 *   // Now it is listening: from here on, the server answers requests.
 * });
 *
 * @returns {http.Server} A server that has not been started yet.
 */
export function createServer() {
  // `http.createServer(listener)` builds a server around one function, the
  // request listener. Node calls that function once for every request that
  // arrives, except CONNECT (the 'connect' listener further down answers
  // that one), and passes it two objects:
  // - `req` (an `http.IncomingMessage`) is what the client sent: the method,
  //   the URL and the headers;
  // - `res` (an `http.ServerResponse`) is what we send back: a status code,
  //   headers and a body.
  const server = http.createServer((req, res) => {
    // Step 1: work out which path the client asked for.
    //
    // `pathnameOf`, above, explains how: it drops the query string, so a
    // request for `/hello?name=ada` has the pathname '/hello', and it
    // returns `false` for a target that cannot be parsed, which matches no
    // route and gets the ordinary 404 below instead of crashing the server.
    const pathname = pathnameOf(req.url);

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
    // handler from its own module, next to src/hello.js. Add the new path to
    // the check in the 'connect' listener below too, so that a CONNECT to it
    // is refused with 405 like the other methods its handler does not serve.
    if (pathname === '/hello') {
      helloHandler(req, res);
      return;
    }

    // Step 3: answer everything else with 404 Not Found.
    //
    // This part is required, not optional. If this branch simply returned
    // without writing and ending a reply, the client would get nothing back
    // and would sit waiting on an open connection until it gave up. Sending
    // some data is not the same as finishing: `res.write` can send the status
    // line, the headers and part of a body early, but until `res.end` is
    // called the response is unfinished and the client keeps waiting for the
    // rest. `res.end(body)` below writes the body and finishes the response
    // in one call; for a HEAD request Node leaves the body out but still
    // finishes the response. The headers follow the same rules as
    // src/hello.js: say the body is plain UTF-8 text, and say exactly how many
    // bytes it holds (`Buffer.byteLength` counts bytes, here 9).
    const body = 'Not Found';
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  });

  // CONNECT is the one method that never reaches the request listener above.
  //
  // A client sends CONNECT to ask a proxy server to open a tunnel to another
  // server, such as `CONNECT example.com:443`, and from then on to pass bytes
  // back and forth between the two. Once a tunnel is open, the connection no
  // longer carries HTTP, so Node does not treat CONNECT as an ordinary
  // request. It never calls the request listener for it, so helloHandler
  // never sees it either. Instead, Node emits the server's 'connect' event
  // and hands its listener `req` together with `socket`, the raw network
  // connection itself. There is no `res` object.
  //
  // If no 'connect' listener is registered, Node closes the connection
  // without sending a single byte, and the client gets no answer at all
  // (curl reports `Empty reply from server`). This server is not a proxy, so
  // this listener refuses every CONNECT, choosing the refusal by the same
  // pathname the request listener routes on:
  // - `/hello` receives 405 Method Not Allowed with `Allow: GET, HEAD`, the
  //   same refusal helloHandler gives every method other than GET and HEAD.
  //   helloHandler never sees CONNECT, so this listener states it itself;
  // - any other target receives 404 Not Found. That includes the usual
  //   proxy form, `CONNECT host:port`, which names a server, not a path.
  server.on('connect', (req, socket) => {
    // Once Node has handed the socket over, closing it is our job: nothing
    // else will. Left open, it would stay open for as long as the client
    // kept its own end open, and neither of the two calls src/index.js makes
    // when you press Ctrl+C would end it: `server.close()` waits for every
    // open connection to end, and `server.closeAllConnections()` reaches
    // only the connections Node's HTTP code still looks after, which this
    // one no longer is. `close` destroys the socket, which ends the
    // connection straight away.
    const close = () => socket.destroy();

    // A socket emits an 'error' event when something goes wrong on the
    // connection, for example when the client resets it before our answer
    // has been sent. Node's HTTP server listens for those errors itself,
    // but it removed its listener when it handed this socket over. An
    // 'error' event that nothing listens for is thrown as an exception, and
    // that would stop the whole server, not just this one connection. So we
    // listen for it here, and close the socket.
    socket.on('error', close);

    const pathname = pathnameOf(req.url);

    // With no `res`, we write the response text ourselves, and
    // plainTextResponse, above, builds it. `socket.end(text, close)` sends
    // the text, tells the client we have nothing more to send, and calls
    // `close` once all of it has been handed to the operating system to
    // deliver. The early `return` stops here once /hello is answered.
    if (pathname === '/hello') {
      socket.end(
        plainTextResponse(405, { Allow: 'GET, HEAD' }, 'Method Not Allowed'),
        close,
      );
      return;
    }

    socket.end(plainTextResponse(404, {}, 'Not Found'), close);
  });

  return server;
}
