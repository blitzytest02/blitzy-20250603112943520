// src/index.js - the process entry point: the file Node runs when you type
// `npm start`.
//
// The `start` script in package.json is `node src/index.js`, so this is where
// the program begins. It sits at the top of a one-way chain:
//
//   src/index.js  -->  src/server.js  -->  src/hello.js
//   (starts it)        (routes it)         (answers /hello)
//
// This is the only file of the application that opens a network socket: the
// listening socket that `npm start` gives you, on PORT or DEFAULT_PORT. (The
// tests open short-lived sockets of their own, on ports the operating system
// picks.) The other two source files only describe how to answer a request;
// this file decides when and where the server listens, what happens if it
// cannot, and how it stops. Keeping that work here is what lets the tests
// import src/server.js without starting anything. This file exports nothing:
// it is run, never imported.
//
// It does four things, in order:
//   1. works out which port to use;
//   2. creates the server and says what to do if it cannot start;
//   3. starts listening and prints the address to call;
//   4. stops the server cleanly when you press Ctrl+C.

import { createServer, DEFAULT_PORT, HOST } from './server.js';

// Step 1: work out which port to listen on.
//
// An environment variable is a named piece of text that your shell hands to
// every program it starts. Node collects them in `process.env` (`process` is a
// global that Node provides to every module, so it needs no import), and
// `process.env.PORT` is the value of the variable named PORT, or `undefined`
// when it is not set. Setting PORT lets you choose another port without
// editing any code. Each shell spells that differently, so the README's
// "Change the port" section shows the bash and zsh, PowerShell and cmd.exe
// forms.
//
// Environment variables are always text, so `Number.parseInt(text, 10)` turns
// the value into a number (the 10 means "read it as a decimal number"). It
// takes the whole number at the start of the text, after any leading
// whitespace and an optional + or - sign, and silently drops whatever follows
// it. So `8080junk` selects port 8080, and `1.5` asks for port 1.
//
// The result is used only when it is a positive whole number. PORT falls back
// to DEFAULT_PORT from src/server.js when it is unset, empty or does not start
// with a number (such as `abc`), or when the number it starts with is 0 or
// negative (such as `-5`). Port 0 is refused on purpose: to `listen`, 0 means
// "any free port", and a tutorial server needs an address you can predict.
//
// A number too large to be a port (above 65535) is deliberately not checked
// here: `listen` rejects it with Node's own ERR_SOCKET_BAD_PORT error, and the
// program stops with that message and its stack trace.
const requestedPort = Number.parseInt(process.env.PORT, 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : DEFAULT_PORT;

// Step 2: create the server and decide what happens if it cannot start.
//
// `createServer()` returns a server that knows how to answer requests but is
// not listening yet: nothing can reach it until `listen` is called in step 3.
const server = createServer();

// Starting a server can fail, and by far the most common reason is
// EADDRINUSE, "address in use": another program already holds this port. Very
// often that program is an earlier `npm start` still running in another
// terminal window.
//
// Why does the failure arrive as an 'error' event instead of being thrown by
// `listen`? Because `listen` is asynchronous: it asks the operating system for
// the port and returns straight away, before the answer comes back. When the
// operating system later replies "that port is taken", `listen` has already
// returned, so there is no call left to throw from. Node reports the failure
// by emitting an 'error' event on the server instead. This listener is
// registered before `listen` is called, so it is in place whenever that answer
// arrives.
//
// For EADDRINUSE we print one line on stderr (the output stream meant for
// errors) that says what went wrong and how to fix it. The line names the PORT
// variable rather than printing a ready-made command, because that command is
// written differently in bash, PowerShell and cmd.exe; the README shows all
// three.
//
// The program then has to stop with code 1, the conventional "something
// failed" status. It does that by setting `process.exitCode` to 1 rather than
// by calling `process.exit(1)`. Printing to stderr can finish later than the
// `console.error` call that asked for it: when the output goes through a pipe
// (the `|` in a shell command) to a program that is reading slowly, or to a
// terminal window on Windows, the text may still be waiting to be written out
// when `console.error` returns. `process.exit` ends the program on the spot,
// so that waiting message would be lost. Setting `exitCode` only records the
// failing status. The program then ends on its own as soon as nothing is left
// to do, and exits with that status. Here that is right after the message has
// been written, because the server never started listening.
//
// The stop-signal handlers from step 4, for SIGINT (sent by Ctrl+C) and
// SIGTERM, are removed at the same moment. The server never started, so they
// have nothing to close, and their `process.exit(0)` would report success if a
// signal arrived while the message was still being written. Without them, a
// signal in that moment stops the program the ordinary way, with a failing
// status. (`shutdown` is defined in step 4 below; that is fine, because this
// code runs only later, once `listen` has failed.)
//
// Any other error is unexpected, so it is thrown again rather than hidden:
// Node then prints the full error with its stack trace and exits, and you see
// exactly what happened.
server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') {
    throw error;
  }

  console.error(
    `Port ${port} is already in use. Set the PORT environment variable to a free port, for example 3001, and start again - see "Change the port" in the README.`,
  );
  process.exitCode = 1;
  process.off('SIGINT', shutdown);
  process.off('SIGTERM', shutdown);
});

// Step 3: start listening.
//
// `server.listen(port, host, callback)` asks the operating system to hand this
// server every connection made to that port on that address. The address is
// HOST, 127.0.0.1 (loopback), so only programs on this computer can connect;
// the server stays invisible to the rest of your network.
//
// Like the failure above, success is reported later: Node calls the callback
// once the socket is bound and the server is ready to accept requests. That is
// the moment to print where to send one. From then on the open socket keeps
// the program running in the foreground, waiting for requests, until you stop
// it.
server.listen(port, HOST, () => {
  console.log(`Server listening at http://${HOST}:${port}/ - try http://${HOST}:${port}/hello`);
});

// Step 4: stop cleanly when asked to.
//
// Pressing Ctrl+C in the terminal sends the program the SIGINT ("interrupt")
// signal. That works on macOS, Linux and Windows, and it is the way the README
// tells you to stop the server. SIGTERM ("terminate") is the stop request that
// process managers and the `kill` command send on macOS and Linux; Windows
// never sends it, so there its handler simply never runs.
//
// Without these handlers Node would end the process the instant a signal
// arrives. With them the stop is deliberate, and it takes two calls.
// `server.close` stops accepting new connections and closes the connections
// that are sitting idle. Its callback runs once no connection is left, and
// exits with code 0, which means "ended normally". Then
// `server.closeAllConnections` closes every connection that is still open, so
// that moment comes straight away. (A CONNECT request's connection is the one
// kind it does not reach, and it does not need to: src/server.js closes that
// connection itself as soon as it has answered.)
//
// Why is `close` not enough on its own? A client can open a connection and
// not send a request on it yet. Browsers open such spare connections ahead of
// time, so that their next request starts sooner, and Node counts them as
// busy, not idle, so `close` leaves them open. One of them would keep the
// program running after Ctrl+C until the browser dropped it, and the stopped
// server would even answer requests sent on it. Closing every connection
// cuts nothing short: src/server.js and src/hello.js write each response in
// full the moment its request arrives, so the only thing dropped is a request
// that is still arriving.
//
// Nothing is printed: the returning shell prompt is the sign that the server
// has stopped.
function shutdown() {
  server.close(() => process.exit(0));
  server.closeAllConnections();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
