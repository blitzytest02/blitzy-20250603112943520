# Express.js Web Server

A simple Express.js-based web application with multiple endpoints, demonstrating the migration from basic Node.js HTTP server to a robust Express.js framework.

## Features

- **Express.js Framework**: Utilizes Express.js 4.21.2 for enhanced routing and middleware support
- **Multiple Endpoints**: 
  - `GET /` - Returns "Hello world"
  - `GET /evening` - Returns "Good evening"
- **Error Handling**: 404 responses for undefined routes
- **Environment Configuration**: Configurable port via PORT environment variable (defaults to 3000)

## Prerequisites

- Node.js ≥14.0.0 LTS (tested with Node.js 18.20.8)
- npm ≥6.0.0 (tested with npm 10.8.2)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Start the Server

```bash
npm start
```

Or directly with Node.js:
```bash
node server.js
```

The server will start on http://localhost:3000 by default.

### Custom Port

You can specify a custom port using the PORT environment variable:
```bash
PORT=8080 npm start
```

## API Endpoints

### GET /
Returns a simple "Hello world" message.

**Response:**
```
Hello world
```

### GET /evening
Returns a "Good evening" message.

**Response:**
```
Good evening
```

## Testing the Endpoints

You can test the endpoints using curl:

```bash
# Test root endpoint
curl http://localhost:3000/

# Test evening endpoint
curl http://localhost:3000/evening

# Test 404 handling
curl http://localhost:3000/nonexistent
```

## Project Structure

```
├── .gitignore          # Git ignore file
├── package.json        # Project configuration and dependencies
├── package-lock.json   # Locked dependency versions
├── server.js          # Main Express.js server file
└── README.md          # This file
```

## Dependencies

- **express**: ^4.21.0 - Web application framework for Node.js

## Development

For development with automatic restart on file changes, consider installing and using nodemon:

```bash
npm install -g nodemon
nodemon server.js
```

## Version Information

- Node.js: v18.20.8 (LTS)
- npm: v10.8.2
- Express.js: v4.21.2
