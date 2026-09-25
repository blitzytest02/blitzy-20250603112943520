// src/index.js - the process entry point: the file Node runs when you type
// `npm start`.
//
// The `start` script in package.json is `node src/index.js`, so this is where
// the program begins. It sits at the top of a one-way chain:
//
//   src/index.js  -->  src/server.js  -->  src/hello.js
//   (starts it)        (routes it)         (answers /hello)
//
// This is the only file in the project that opens a network socket. The other
// two only describe how to answer a request; this file decides when and where
// the server listens, what happens if it cannot, and how it stops. Keeping that
// work here is what lets the tests import src/server.js without starting
// anything. This file exports nothing: it is run, never imported.
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
// the value into a number (the 10 means "read it as a decimal number"). The
// result is used only when it is a positive whole number. PORT unset, empty,
// not a number, 0 or negative all fall back to DEFAULT_PORT from
// src/server.js. Port 0 is refused on purpose: to `listen`, 0 means "any free
// port", and a tutorial server needs an address you can predict.
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
// errors) that says what went wrong and how to fix it, then exit with code 1,
// the conventional "something failed" status. The line names the PORT
// variable rather than printing a ready-made command, because that command is
// written differently in bash, PowerShell and cmd.exe; the README shows all
// three. Any other error is unexpected, so it is thrown again rather than
// hidden: Node then prints the full error with its stack trace and exits, and
// you see exactly what happened.
server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') {
    throw error;
  }

  console.error(
    `Port ${port} is already in use. Set the PORT environment variable to a free port, for example 3001, and start again - see "Change the port" in the README.`,
  );
  process.exit(1);
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
// arrives. With them the stop is deliberate: `server.close` stops accepting
// new connections, closes connections that are sitting idle, and calls its
// callback once every connection still open has finished. Then the process
// exits with code 0, which means "ended normally". Nothing is printed: the
// returning shell prompt is the sign that the server has stopped.
function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
