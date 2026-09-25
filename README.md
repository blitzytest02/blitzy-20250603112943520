# Node.js Hello World Tutorial

Build and run a Node.js HTTP server with one endpoint, `/hello`, that answers with `Hello world`, and learn how every piece of it works.

## Contents

1. [What this project is](#what-this-project-is)
2. [Prerequisites](#prerequisites)
3. [Install](#install)
4. [Run](#run)
5. [Call the endpoint](#call-the-endpoint)
6. [Project structure](#project-structure)
7. [How it works](#how-it-works)
8. [Change the port](#change-the-port)
9. [Run the tests](#run-the-tests)
10. [Troubleshooting](#troubleshooting)
11. [Next steps](#next-steps)

## What this project is

This is a small Node.js HTTP server with exactly one endpoint, `/hello`. Send it a request for `/hello` and it answers with the text `Hello world`. That is the whole product. The point is not what the server does but how it is put together, so the source and test files are short and explain themselves in their comments. The configuration files, `package.json`, `package-lock.json` and `.nvmrc`, carry no comments, so this README explains them instead.

It uses only what ships with Node.js: the built-in `node:http` module for the server, the built-in `node:test` and `node:assert` modules for the tests, and the global `fetch` function as the tests' HTTP client. There are no dependencies to install: no web framework, no test library and no build step.

Working through this tutorial, you will see how to:

- create an HTTP server with `http.createServer` and a request listener;
- route a request by its path;
- write a response: a status code, headers and a body;
- listen for connections on a host and port;
- read configuration from an environment variable, `PORT`;
- report a port that is already in use (`EADDRINUSE`) and stop the server cleanly with Ctrl+C;
- test an HTTP endpoint with the built-in `node:test` runner.

## Prerequisites

- **Node.js 22 or newer**, on a supported long-term support (LTS) line:
  - **Node.js 24** (Active LTS), recommended, and the line this project is developed on;
  - **Node.js 22** (Maintenance LTS).

  `package.json` declares `"engines": { "node": ">=22.0.0" }`. That range is a floor: Node.js 20 and earlier are not supported. Newer releases above the floor are accepted, but the two LTS lines above are the ones this project is tested on.
- **npm**, which is installed together with Node.js.
- **curl** or a **web browser**, to call the endpoint. curl ships with macOS, most Linux distributions, and Windows 10 and later.

Check which Node.js version you have:

```bash
node --version
```

The version must be `v22.0.0` or later, the floor that `package.json` declares, and should start with `v24` (recommended) or `v22`, the two supported LTS lines this project is tested on. For example:

```text
v24.21.0
```

If you use a Node.js version manager such as nvm, the `.nvmrc` file names the development line, `24`. Running `nvm use` in the project folder switches to Node.js 24 if a 24 release is already installed. If none is, nvm stops and tells you to run `nvm install 24`: do that first, and it installs the latest 24.x release and switches to it. The file is advisory: nothing in the project reads it, and you do not need to switch versions if yours is already on Node.js 22 or 24.

## Install

Get the code. Either clone the repository with git, or download it as a ZIP file and extract it. Then open a terminal in the project folder:

```bash
git clone <repository-url>
cd <project-folder>
```

Replace `<repository-url>` with this repository's clone address, and `<project-folder>` with the folder the clone created (git names it after the repository). If you downloaded the ZIP, `cd` into the extracted folder instead.

Install the project:

```bash
npm install
```

```text
up to date, audited 1 package in 151ms

found 0 vulnerabilities
```

The time varies from run to run. "up to date" and "1 package" mean npm had nothing to download: the only package it checked is this project itself, because the project has no dependencies. No `node_modules` folder is created. The committed `package-lock.json` records that empty dependency list, and `npm install` leaves it unchanged.

Running `npm install` is still the right habit. The day a project gains dependencies, this is the step that fetches them.

## Run

Start the server:

```bash
npm start
```

npm first prints which script it is running, then the server prints the address it is listening on:

```text
> node-hello-tutorial@1.0.0 start
> node src/index.js

Server listening at http://127.0.0.1:3000/ - try http://127.0.0.1:3000/hello
```

The two lines starting with `>` come from npm: `npm start` runs the `start` script from `package.json`, which is `node src/index.js`. The last line comes from the server itself, once it is ready to accept requests.

The command does not return you to the prompt. The server keeps running in the foreground, waiting for requests, so leave this terminal open while you work through the next section.

To stop the server, press **Ctrl+C** in this terminal. This works the same on macOS, Linux and Windows. The server closes, nothing more is printed, and your prompt comes back.

## Call the endpoint

Open a **second** terminal, since the first one is busy running the server, and ask for `/hello`:

```bash
curl http://127.0.0.1:3000/hello
```

```text
Hello world
```

The body is exactly those 11 characters, with no newline at the end. Your shell prompt may therefore appear on the same line, straight after `Hello world`. That is expected.

You can also open <http://127.0.0.1:3000/hello> in a web browser. The page shows `Hello world` as plain text.

To see the whole response, including the status line and the headers, add `-i`:

```bash
curl -i http://127.0.0.1:3000/hello
```

```text
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 11
Date: <varies>
Connection: keep-alive
Keep-Alive: timeout=5

Hello world
```

Reading it from the top:

- `HTTP/1.1 200 OK` is the status line. `200` means success.
- `Content-Type` and `Content-Length` are set by `src/hello.js`. They say the body is plain text in UTF-8 and is 11 bytes long.
- `Date`, `Connection` and `Keep-Alive` are added by Node.js itself. `Date` is filled in from the current time, to the second, so it changes as time passes, but two requests made within the same second show the same value. `Connection: keep-alive` and `Keep-Alive: timeout=5` tell the client it may reuse the same connection for another request within 5 seconds.
- The blank line marks the end of the headers.
- `Hello world` is the body.

### On Windows

Windows 10 and later include curl as `curl.exe`. In PowerShell, type the `.exe`: in Windows PowerShell 5.1 the bare name `curl` is an alias for PowerShell's own `Invoke-WebRequest` command, which takes different arguments and prints a different result.

```powershell
curl.exe http://127.0.0.1:3000/hello
```

```text
Hello world
```

Add `-i` to see the status line and the headers:

```powershell
curl.exe -i http://127.0.0.1:3000/hello
```

```text
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 11
Date: <varies>
Connection: keep-alive
Keep-Alive: timeout=5

Hello world
```

This is the same curl as on macOS and Linux, so the output matches the examples above. In `cmd.exe`, `curl` and `curl.exe` are the same program, so either works.

If you prefer a PowerShell command, `Invoke-WebRequest` is the native alternative. Give it the `-UseBasicParsing` switch, so the same command works in every PowerShell version:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/hello
```

```text
StatusCode        : 200
StatusDescription : OK
Content           : Hello world
RawContent        : HTTP/1.1 200 OK
                    ...
RawContentLength  : 11
```

`Invoke-WebRequest` prints a summary of the response rather than only its body. The summary above is shortened: `...` stands for the rest of the headers and the body, and the real summary lists more properties, such as `Headers`. Look for `StatusCode : 200` and `Content : Hello world`.

`-UseBasicParsing` tells PowerShell to read the response without the Internet Explorer engine. Without it, Windows PowerShell 5.1, the version built into Windows 10 and 11, hands the response to that engine to parse it as a web page. With Windows updates from December 9, 2025 onwards installed, it first stops at a `Security Warning: Script Execution Risk` question that ends `Do you want to continue?`. That question is a general safeguard for web pages that contain scripts, not a sign that anything is wrong with this server. Pressing Enter, or answering No, cancels the command, and PowerShell suggests running it again with `-UseBasicParsing`. On an older system without those updates and without the Internet Explorer engine, the command fails instead, with an error saying that the Internet Explorer engine is not available. PowerShell 7 and later never use the Internet Explorer engine and accept the switch without effect, so there the shorter form, `Invoke-WebRequest http://127.0.0.1:3000/hello`, works unchanged.

### Try the other answers

The server answers every request, including the ones it cannot serve. These requests are optional, but they show the rest of the endpoint's behaviour. On Windows, use `curl.exe` for them too.

`curl -I` sends a `HEAD` request, which asks for the headers a `GET` would receive, without the body:

```bash
curl -I http://127.0.0.1:3000/hello
```

```text
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 11
Date: <varies>
Connection: keep-alive
Keep-Alive: timeout=5
```

Any method other than `GET` or `HEAD`, such as `POST`, is refused with `405 Method Not Allowed`. The `Allow` header lists the methods that would work:

```bash
curl -i -X POST http://127.0.0.1:3000/hello
```

```text
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
Content-Type: text/plain; charset=utf-8
Content-Length: 18
Date: <varies>
Connection: keep-alive
Keep-Alive: timeout=5

Method Not Allowed
```

Any path other than `/hello` is answered with `404 Not Found`:

```bash
curl -i http://127.0.0.1:3000/goodbye
```

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 9
Date: <varies>
Connection: keep-alive
Keep-Alive: timeout=5

Not Found
```

A query string does not change the answer, because the server never reads it:

```bash
curl "http://127.0.0.1:3000/hello?name=ada"
```

```text
Hello world
```

Keep the quotes around that URL. Some shells, zsh among them, treat `?` as a wildcard and stop with `no matches found` when it is left unquoted.

## Project structure

The whole project is nine files:

```text
.
├── src/
│   ├── index.js          # Entry point: picks the port, starts listening, reports a busy port, stops on Ctrl+C
│   ├── server.js         # createServer(): builds the server and routes each request by its path
│   └── hello.js          # GREETING and helloHandler: the /hello endpoint itself
├── test/
│   └── hello.test.js     # Five tests that check the /hello endpoint over real HTTP
├── .gitignore            # Tells git not to track node_modules/
├── .nvmrc                # The development Node.js line, 24, for version managers
├── package.json          # Project manifest: ES modules, supported Node.js versions, start and test scripts
├── package-lock.json     # The exact dependency tree (empty here), generated by npm install
└── README.md             # This walkthrough
```

The three source files form a one-way chain. Each imports only the file to its right, and nothing imports back:

```text
src/index.js  -->  src/server.js  -->  src/hello.js
(starts it)        (routes it)         (answers /hello)
```

The split between `src/index.js` and `src/server.js` is deliberate. Importing `src/server.js` does no work: it exports two constants (`DEFAULT_PORT` and `HOST`) and one function (`createServer`), keeps one private constant for parsing URLs, and opens no network socket. Only `src/index.js`, which is run and never imported, starts the application's server listening, on port 3000 or the port in `PORT`. That is what lets the tests import `createServer`, start their own server on a port of their choosing, and never touch port 3000.

A good reading order is `src/hello.js`, then `src/server.js`, then `src/index.js`, then `test/hello.test.js`.

## How it works

Each concept below is visible in the file named in its heading. The comments in those files go into more detail.

### Creating a server (`src/server.js`)

`http.createServer(listener)`, from the built-in `node:http` module, builds a server around one function, the *request listener*. Node.js calls that function once for every request that arrives and passes it two objects:

- `req`, an `http.IncomingMessage`: what the client sent, meaning the method, the URL and the headers;
- `res`, an `http.ServerResponse`: what you send back, meaning a status code, headers and a body.

This project's `createServer()` returns that server without starting it. Whoever calls it decides when and where it listens.

### Routing on the path (`src/server.js`)

`req.url` is the raw request target, and it includes the query string: a request for `/hello?name=ada` has a `req.url` of `/hello?name=ada`, which would never equal `/hello`. So the request listener parses it with `new URL(req.url, 'http://localhost')` and keeps only the `pathname` part, `/hello`.

`new URL` needs a complete address to resolve a path against, and not every address works as that base: a `mailto:` address cannot have a path resolved against it at all, and a base with a path of its own, such as `http://localhost/app/`, changes where a target that does not start with `/` lands. A web address with nothing after the host, such as `http://localhost`, is a suitable base: `/hello?name=ada` resolves against it to exactly that path, and because only the path is read back out, the host it names is never used. The base is a fixed literal, `'http://localhost'`, rather than one built from the request's `Host` header, on purpose. The host is not needed, and a `Host` value that Node's HTTP parser accepts can still be one the URL parser rejects. An error thrown inside the request listener is caught by nothing, so it would stop the whole server. For the same reason, the listener first checks the target with `URL.canParse`: a target that cannot be parsed matches no route and receives an ordinary 404 instead of crashing the server.

Matching is exact and case-sensitive:

| Request path | Answer |
|---|---|
| `/hello` | `200` with `Hello world` |
| `/hello?name=ada` | `200` with `Hello world`; the query string is never read |
| `/hello/` | `404`; a trailing slash makes it a different path |
| `/HELLO` | `404`; paths are case-sensitive |
| `/`, `/goodbye`, anything else | `404` with `Not Found` |

These are decisions, not bugs: the router compares the path with `'/hello'` and nothing else, and it does not normalize slashes or letter case.

The `404` branch is required, not a nicety. A request listener that returns without ending the response sends nothing back, and the client sits waiting on an open connection until it gives up.

### Checking the method (`src/hello.js`)

`helloHandler` looks at `req.method` before anything else. `GET` (what a browser or a plain `curl` sends) and `HEAD` are served. Any other method is refused with `405 Method Not Allowed`, the header `Allow: GET, HEAD` and the body `Method Not Allowed`, rather than with a success the client would wrongly trust. An early `return` ends the function right after the refusal.

`HEAD` needs no code of its own. For a `HEAD` request, Node.js sends the status line and headers and drops the body automatically. `Content-Length: 11` is still sent, because for `HEAD` that header reports the size of the body a `GET` would receive.

### Writing the response (`src/hello.js`)

The success answer is two calls:

```js
res.writeHead(200, {
  'Content-Type': 'text/plain; charset=utf-8',
  'Content-Length': Buffer.byteLength(GREETING),
});
res.end(GREETING);
```

`res.writeHead(status, headers)` sets the status line and the headers, which always travel before the body. `res.end(body)` sends the body and marks the response as finished. Every response must be ended; until it is, the client keeps waiting for more.

Both headers are set explicitly:

- `Content-Type: text/plain; charset=utf-8` tells the client the body is plain text encoded as UTF-8, so a browser shows the words as text instead of guessing the type or offering a file download.
- `Content-Length` tells the client exactly how many bytes of body to expect, so it knows where the response ends. `Buffer.byteLength` counts bytes, not characters. The two are equal for `Hello world` (11), but an accented letter takes two bytes in UTF-8, and the header must carry the byte count.

`GREETING` is the constant `'Hello world'`, defined at the top of the same file, next to the code that sends it.

### Listening on a host and port (`src/index.js`, `src/server.js`)

`server.listen(port, HOST, callback)` asks the operating system to hand the server every connection made to that port on that address. `HOST` is exported by `src/server.js` and is `127.0.0.1`, the loopback address, which means "this computer only". Programs on your own machine can connect, and nothing else on your network can reach the server. That is the right default for a tutorial server, so the host is deliberately fixed and cannot be changed by an environment variable.

`listen` returns straight away and reports success later: Node.js calls the callback once the socket is bound and ready. That is the moment the server prints its `Server listening at ...` line. From then on, the open socket keeps the program running until you stop it.

### Reading the port from the environment (`src/index.js`)

An environment variable is a named piece of text that your shell hands to every program it starts. Node.js collects them in `process.env`, so `process.env.PORT` is the value of the variable named `PORT`, or `undefined` when it is not set.

Environment variables are always text, so `Number.parseInt(process.env.PORT, 10)` turns the value into a number. The result is used only when it is a positive whole number. Otherwise the server uses `DEFAULT_PORT`, which `src/server.js` sets to `3000`. Port `0` is refused on purpose: to `listen`, `0` means "any free port", and a tutorial server needs an address you can predict. A number too large to be a port (above 65535) is left for `listen` to reject with Node's own `ERR_SOCKET_BAD_PORT` error. See [Change the port](#change-the-port) for how to set `PORT`.

### Handling a port that is already in use (`src/index.js`)

Starting a server can fail. By far the most common reason is `EADDRINUSE`, "address in use": another program already holds the port, very often an earlier `npm start` still running in another terminal.

Because `listen` returns before the operating system answers, the failure cannot be thrown by `listen`. Node.js reports it later as an `'error'` event on the server instead, so `src/index.js` registers an `'error'` listener before calling `listen`. For `EADDRINUSE`, it prints one line on stderr (the output stream meant for errors) that says what went wrong and how to fix it, then exits with code `1`, the conventional "something failed" status. Any other error is unexpected, so it is thrown again rather than hidden: Node.js then prints the full error with its stack trace. The exact message is shown under [Troubleshooting](#troubleshooting).

### Stopping cleanly (`src/index.js`)

Pressing Ctrl+C sends the program the `SIGINT` ("interrupt") signal. `src/index.js` handles it by calling `server.close`, which stops accepting new connections, closes connections that are sitting idle, and waits for any request still in progress to finish. The process then exits with code `0`, meaning "ended normally". The same handler also covers `SIGTERM`, the stop request that process managers use on macOS and Linux, so you never need anything other than Ctrl+C yourself.

### ES modules (`package.json`, `src/server.js`)

`"type": "module"` in `package.json` makes every `.js` file in the project an ES module. Files share code with `export` and `import`, the standard JavaScript syntax, and nothing uses `require`. The imports at the top of `src/server.js` show two details worth noticing:

```js
import http from 'node:http';
import { helloHandler } from './hello.js';
```

Built-in modules are imported with the `node:` prefix, and imports of your own files include the `.js` extension, because ES modules import files by their full name.

## Change the port

The server listens on port 3000 unless you set the `PORT` environment variable. Stop the running server with Ctrl+C first, then start it again with the form for your shell.

bash or zsh (macOS, Linux, Git Bash on Windows):

```bash
PORT=8080 npm start
```

```text
> node-hello-tutorial@1.0.0 start
> node src/index.js

Server listening at http://127.0.0.1:8080/ - try http://127.0.0.1:8080/hello
```

PowerShell:

```powershell
$env:PORT=8080; npm start
```

```text
> node-hello-tutorial@1.0.0 start
> node src/index.js

Server listening at http://127.0.0.1:8080/ - try http://127.0.0.1:8080/hello
```

Command Prompt (`cmd.exe`):

```bat
set PORT=8080 && npm start
```

```text
> node-hello-tutorial@1.0.0 start
> node src/index.js

Server listening at http://127.0.0.1:8080/ - try http://127.0.0.1:8080/hello
```

Whichever form you use, the startup line names the new port.

Call it from your second terminal (`curl.exe` on Windows):

```bash
curl http://127.0.0.1:8080/hello
```

```text
Hello world
```

A few things to know:

- The bash and zsh form sets `PORT` for that one command only. The PowerShell and `cmd.exe` forms set it for the rest of that terminal window, so a later `npm start` in the same window also uses 8080. To go back to 3000, open a new window, or clear the variable with `Remove-Item Env:PORT` in PowerShell or `set PORT=` in `cmd.exe`.
- `PORT` is read with `Number.parseInt`, which takes the whole number at the start of the text and silently drops whatever follows it. The server uses that number only when it is a positive whole number. Otherwise, as with an empty value, `abc`, `0` or `-5`, it uses port 3000. Because trailing text is dropped, `8080junk` starts the server on port 8080 and `1.5` asks for port 1, so set `PORT` to digits only, such as `8080`.
- Only the port can be changed. The host is always `127.0.0.1`, so the server stays reachable from your own computer only.

## Run the tests

The tests start a real server, send it real HTTP requests and check the answers. Run them with:

```bash
npm test
```

On Node.js 24 the output looks like this (the timings vary):

```text
> node-hello-tutorial@1.0.0 test
> node --test

✔ GET /hello returns the greeting (23.714592ms)
✔ HEAD /hello returns headers only (5.317753ms)
✔ Path matching is exact (6.213964ms)
✔ An unknown path is not found (2.702751ms)
✔ An unsupported method is rejected (2.821098ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 150.334301
```

The lines that matter are `ℹ pass 5` and `ℹ fail 0`: all five tests passed. Node.js 22 prints the same summary in a terminal. When the output is not a terminal, for example when it is piped into a file or a CI log, Node.js 22 uses the TAP format instead, and the same result reads `# pass 5` and `# fail 0`; `node --test --test-reporter=tap` asks for that format on any version.

`npm test` runs `node --test`, which finds test files by convention, including anything inside a `test/` directory. So it finds `test/hello.test.js` with no configuration file. Nothing is installed for the tests either: the runner is `node:test`, the checks come from `node:assert/strict`, and the HTTP client is the global `fetch`, all built into Node.js.

The five tests, and what each one checks:

| Test | What it checks |
|---|---|
| `GET /hello returns the greeting` | Status `200`, `Content-Type: text/plain; charset=utf-8`, `Content-Length: 11`, and a body of exactly `Hello world` |
| `HEAD /hello returns headers only` | Status `200`, the same two headers, and an empty body |
| `Path matching is exact` | `/hello?name=ada` returns `200` with `Hello world`; `/hello/`, `/HELLO` and `/` each return `404` |
| `An unknown path is not found` | `/goodbye` returns `404`, `text/plain; charset=utf-8` and `Not Found`, and so does a malformed request target, instead of crashing the server |
| `An unsupported method is rejected` | `POST /hello` returns `405`, `Allow: GET, HEAD` and `Method Not Allowed` |

The tests listen on port `0`, which asks the operating system for any free port. That is why they pass whether or not port 3000 is free, including while your own `npm start` is still running in another terminal.

To see how much of the code the tests exercise, run the test runner with coverage reporting turned on:

```bash
node --test --experimental-test-coverage
```

After the test results, it prints a coverage report:

```text
ℹ start of coverage report
ℹ -----------------------------------------------------------
ℹ file       | line % | branch % | funcs % | uncovered lines
ℹ -----------------------------------------------------------
ℹ src        |        |          |         |
ℹ  hello.js  | 100.00 |   100.00 |  100.00 |
ℹ  server.js | 100.00 |   100.00 |  100.00 |
ℹ -----------------------------------------------------------
ℹ all files  | 100.00 |   100.00 |  100.00 |
ℹ -----------------------------------------------------------
ℹ end of coverage report
```

Every line and every branch of `src/hello.js` and `src/server.js` is tested. `src/index.js` does not appear because the tests never load it: it binds a real port and reads the environment, and the tests create their own server instead.

## Troubleshooting

### The port is already in use

`npm start` stops straight away with this message:

```text
Port 3000 is already in use. Set the PORT environment variable to a free port, for example 3001, and start again - see "Change the port" in the README.
```

The process exits with code `1`. Another program already holds the port named in the message, most often an earlier `npm start` still running in another terminal. Either find that terminal and press Ctrl+C there, or start the server on a free port as shown in [Change the port](#change-the-port).

### Node.js is too old

`node --version` prints a version below `v22.0.0`, and `npm install` prints an `EBADENGINE` "Unsupported engine" warning that names `node-hello-tutorial@1.0.0`, the required range `>=22.0.0`, and your current version. npm continues after the warning, but this project is not supported on that version.

Install a current LTS release of Node.js, 24 recommended, from <https://nodejs.org>, or with your version manager (for example `nvm install 24`). Open a new terminal and check `node --version` again.

### `curl` in PowerShell prints something unexpected

If `curl` in PowerShell prints a block of response properties instead of `Hello world`, complains about a parameter name, or stops at a `Security Warning: Script Execution Risk` question, you are running PowerShell's `Invoke-WebRequest` alias rather than curl. Type `curl.exe` instead; see [On Windows](#on-windows).

### curl cannot connect

A message beginning `curl: (7) Failed to connect to 127.0.0.1 port 3000` means nothing is listening on that port. Check that the terminal running `npm start` is still open and showing the `Server listening at ...` line, and that the port in your URL matches the port in that line.

## Next steps

### Add a second route

The natural exercise is a second endpoint, for example `/goodbye` answering `Goodbye world`. It takes one new handler module and one new branch in the router:

1. Copy `src/hello.js` to `src/goodbye.js`. In the copy, rename `helloHandler` to `goodbyeHandler`, and change `GREETING` to `'Goodbye world'`. The method check and the headers stay as they are.
2. In `src/server.js`, import the new handler next to the existing import, and add one branch beside the `/hello` one:

   ```js
   import { goodbyeHandler } from './goodbye.js';
   ```

   ```js
       if (pathname === '/goodbye') {
         goodbyeHandler(req, res);
         return;
       }
   ```

3. In `test/hello.test.js`, add a test for the new route, modelled on `GET /hello returns the greeting`.
4. Run `npm test`. The test `An unknown path is not found` now fails, because it uses `/goodbye` as its example of a path the server does not know, and that path now exists. That failure is the tests doing their job: change the path in that test to one that is still unknown, such as `/nowhere`, and run `npm test` again.

### What this project leaves out, on purpose

To keep the lesson on `node:http` itself, this project deliberately has:

- no web framework such as Express, Fastify or Koa, which would hide the request listener, status code, headers and body behind its own API;
- no routes other than `/hello`: no index page and no health check;
- no database or stored state, because the answer is a constant;
- no authentication, sessions or rate limiting;
- no HTTPS: the server speaks plain HTTP on the loopback address only;
- no containers, deployment configuration or process manager;
- no CI workflow: `npm test` on your own machine is the check;
- no linter or formatter configuration;
- no `.env` file, because one optional `PORT` variable does not need one;
- no per-request logging: the only output is the startup line and the port-in-use message;
- no handling of query strings, request headers or request bodies.

Each of these is a reasonable next step once the basics here are clear.
