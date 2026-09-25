// src/hello.js - the one endpoint this tutorial serves: /hello.
//
// This file answers a single question: "a request for /hello has arrived,
// what do we send back?" It does not decide *which* requests reach it; that
// is the router's job in src/server.js, which calls helloHandler only when
// the request path is exactly /hello.
//
// The file imports nothing on purpose, so you can read it from top to bottom
// without opening any other file. (Buffer, used below, is a global that Node
// provides to every module, so it needs no import.)

/**
 * The greeting that /hello sends back: exactly `Hello world`.
 *
 * That casing, one space, no punctuation and no trailing newline, so the
 * response body is exactly 11 bytes. It lives here, next to the code that
 * sends it, rather than in a separate constants file you would have to chase.
 */
export const GREETING = 'Hello world';

/**
 * Answers a request for /hello.
 *
 * Node creates a fresh pair of objects for every request that arrives and
 * hands them to the server's request listener, which passes them on to us.
 * Both types come from Node's built-in `node:http` module:
 *
 * @param {http.IncomingMessage} req The request the client sent: its method
 *   (GET, POST, ...), its URL and its headers. This handler reads only
 *   `req.method`; it never reads a header, the query string or a request
 *   body.
 * @param {http.ServerResponse} res The response we write back: a status
 *   code, some headers and a body.
 * @returns {void} Nothing. The answer travels through `res`, not through a
 *   return value.
 */
export function helloHandler(req, res) {
  // Step 1: check the HTTP method before anything else.
  //
  // GET means "send me this resource", and it is what a browser or a plain
  // `curl` sends. HEAD means "send me only the headers GET would send". Any
  // other method (POST, PUT, DELETE, ...) asks this URL to do something it
  // cannot do, so we refuse it with 405 Method Not Allowed rather than
  // answering with a success the client would wrongly take at face value.
  //
  // The early `return` ends the function right after the refusal, so the
  // success code below never runs for a rejected method.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = 'Method Not Allowed';

    // The `Allow` header lists the methods that *would* work on this URL.
    // HTTP expects it on every 405, and it tells the client how to retry.
    res.writeHead(405, {
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  // Step 2: send the greeting.
  //
  // `res.writeHead(status, headers)` prepares the first part of the response:
  // the status line (here `HTTP/1.1 200 OK`) and the headers. They always
  // travel before the body, which is why they are set first.
  //
  // - `Content-Type` tells the client what kind of data the body holds.
  //   `text/plain` makes a browser show the words as text instead of guessing
  //   the type or offering a file download, and `charset=utf-8` says which
  //   character encoding turns those bytes back into letters.
  // - `Content-Length` tells the client exactly how many bytes of body to
  //   expect, so it knows where the response ends and `curl -i` prints the
  //   same headers every time. `Buffer.byteLength` counts bytes, not
  //   characters: the two happen to be equal for `Hello world` (11), but an
  //   accented letter takes two bytes in UTF-8, and the header must carry
  //   the byte count.
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(GREETING),
  });

  // `res.end(body)` sends the body and marks the response as finished. Every
  // response must be ended: until it is, the client keeps waiting for more.
  //
  // HEAD needs no separate branch. For a HEAD request Node sends the status
  // line and headers (including `Content-Length: 11`, the size a GET would
  // receive) and drops the body automatically.
  res.end(GREETING);
}
