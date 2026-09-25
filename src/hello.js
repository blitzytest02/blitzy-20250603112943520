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
 * Both types come from Node's built-in `node:http` module. The
 * `import('node:http')` written inside the curly braces below is a type
 * reference, read only by editors and type checkers so they can tell you
 * what `req` and `res` hold. It is not a runtime import: it lives inside
 * this comment, so Node never runs it, and the file still imports nothing.
 *
 * @param {import('node:http').IncomingMessage} req The request the client
 *   sent: its method (GET, POST, ...), its URL and its headers. This
 *   handler reads only `req.method`; it never reads a header, the query
 *   string or a request body.
 * @param {import('node:http').ServerResponse} res The response we write
 *   back: a status code, some headers and a body.
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

  // Step 2: write the success response. Only GET and HEAD get this far, and
  // both receive the same status line and headers; they differ only in the
  // body. A GET receives the greeting as its body, while a HEAD receives no
  // body at all.
  //
  // `res.writeHead(status, headers)` prepares the first part of the response:
  // the status line (here `HTTP/1.1 200 OK`) and the headers. They always
  // travel before any body, which is why they are set first.
  //
  // - `Content-Type` tells the client what kind of data the body holds.
  //   `text/plain` makes a browser show the words as text instead of guessing
  //   the type or offering a file download, and `charset=utf-8` says which
  //   character encoding turns those bytes back into letters.
  // - `Content-Length` is the size, in bytes, of the body a GET receives.
  //   After a GET, the client reads exactly that many bytes of body, so it
  //   knows where the response ends. A HEAD response carries the very same
  //   header, reporting the size a GET would receive, but no body follows
  //   it: the headers are the whole response. Because this handler sets the
  //   header explicitly, `curl -i` always shows `Content-Length: 11` for
  //   this response.
  //   Not every header is that stable. Headers Node adds on its own can
  //   change from one response to the next: `Date` is filled in from the
  //   current time, to the second, and `Connection` depends on what the
  //   client asked for.
  //   `Buffer.byteLength` counts bytes, not characters: the two happen to
  //   be equal for `Hello world` (11), but an accented letter takes two
  //   bytes in UTF-8, and the header must carry the byte count.
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(GREETING),
  });

  // `res.end(body)` hands Node the body and marks the response as finished.
  // Every response must be ended: until it is, the client keeps waiting for
  // more.
  //
  // That one call is also why HEAD needs no separate branch. Node knows which
  // method this request used, so for a GET it sends the 11 bytes of
  // `GREETING` after the headers, and for a HEAD it drops them automatically.
  res.end(GREETING);
}
