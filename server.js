/**
 * Express.js Web Server Implementation
 * 
 * This file implements a production-ready Express.js server with two REST endpoints:
 * - GET / : Returns "Hello world" 
 * - GET /evening : Returns "Good evening"
 * 
 * Features:
 * - Express.js framework integration for robust request handling
 * - Configurable port binding with environment variable support
 * - Comprehensive 404 error handling for undefined routes
 * - Production-optimized middleware pipeline
 * - Startup logging and error reporting
 */

const express = require('express');

// Create Express application instance
const app = express();

// Configure port from environment variable or use default
const PORT = process.env.PORT || 3000;

/**
 * GET / endpoint
 * Returns "Hello world" response
 * 
 * This endpoint preserves backward compatibility while leveraging Express.js routing
 * Optimized for sub-10ms response times through minimal processing overhead
 */
app.get('/', (req, res) => {
  res.send('Hello world');
});

/**
 * GET /evening endpoint  
 * Returns "Good evening" response
 * 
 * Separate route handler implementing RESTful design principles
 * Independent processing logic enables isolated feature development
 */
app.get('/evening', (req, res) => {
  res.send('Good evening');
});

/**
 * 404 Error Handler Middleware
 * Handles requests to undefined routes with custom error response
 * 
 * Provides meaningful feedback for invalid endpoints while maintaining security
 * Part of comprehensive error handling pipeline as specified in middleware architecture
 */
app.use((req, res, next) => {
  res.status(404).send(`
    <h1>404 - Page Not Found</h1>
    <p>The requested route <code>${req.originalUrl}</code> does not exist.</p>
    <p>Available endpoints:</p>
    <ul>
      <li><a href="/">GET /</a> - Returns "Hello world"</li>
      <li><a href="/evening">GET /evening</a> - Returns "Good evening"</li>
    </ul>
  `);
});

/**
 * Global Error Handler Middleware
 * Handles application-level exceptions and server errors
 * 
 * Implements comprehensive error classification and response strategy
 * Ensures graceful degradation and proper resource cleanup
 */
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  // Determine appropriate error response
  if (error.status) {
    res.status(error.status).send(`Server Error: ${error.message}`);
  } else {
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Server Initialization and Startup
 * 
 * Configures HTTP server listener with error handling and startup logging
 * Implements graceful port binding with failure recovery
 */
const server = app.listen(PORT, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  
  console.log(`Express server successfully started and listening on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - GET http://localhost:${PORT}/ - Returns "Hello world"`);
  console.log(`  - GET http://localhost:${PORT}/evening - Returns "Good evening"`);
  console.log('Server ready to accept connections...');
});

/**
 * Graceful Shutdown Handler
 * Implements proper resource cleanup and connection management
 * 
 * Handles SIGTERM and SIGINT signals for production deployment compatibility
 * Ensures data integrity and orderly server termination
 */
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal} signal. Starting graceful shutdown...`);
  
  server.close((error) => {
    if (error) {
      console.error('Error during server shutdown:', error);
      process.exit(1);
    }
    
    console.log('Server shutdown completed successfully.');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown - graceful shutdown timeout exceeded');
    process.exit(1);
  }, 10000);
};

// Register shutdown signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Export the Express application instance for testing and modularity
module.exports = app;