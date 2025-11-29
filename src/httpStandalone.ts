#!/usr/bin/env node
/**
 * Standalone HTTP server for local development
 * Runs the MCP server on a local port for testing
 */

import http from 'http';
import type { Socket } from 'net';
import { logger } from './logging.js';
import handler from './httpServer.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Create HTTP server with MCP handler
 */
function createHttpServer() {
  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error('[SERVER] Unhandled error in HTTP handler:', error instanceof Error ? error.message : String(error));
      logger.error('[SERVER] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(500);
        res.end(JSON.stringify({ 
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error)
          }
        }));
      }
    }
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[SERVER] Unhandled promise rejection:', reason);
    logger.error('[SERVER] Promise:', promise);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('[SERVER] Uncaught exception:', error.message);
    logger.error('[SERVER] Error stack:', error.stack);
  });

  return server;
}

/**
 * Start the HTTP server
 */
function startServer() {
  try {
  const server = createHttpServer();
  
  logger.info(`[SERVER] Starting HTTP server on port ${PORT}...`);
  
    server.listen(PORT, () => {
      logger.info(`[SERVER] MCP Server (HTTP) listening on http://localhost:${PORT}`);
      logger.info(`[SERVER] SSE endpoint: http://localhost:${PORT}/message`);
      logger.info('[SERVER] Press Ctrl+C to stop the server');
      logger.info('[SERVER] Server ready to accept connections');
    });

    // Track active connections for graceful shutdown
    const connections = new Set<Socket>();
    
    server.on('connection', (socket: Socket) => {
      connections.add(socket);
      socket.on('close', () => {
        connections.delete(socket);
      });
    });

    // Handle graceful shutdown
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close all active connections
      for (const socket of connections) {
        socket.destroy();
      }

      // Force exit after a short delay if connections don't close
      setTimeout(() => {
        logger.info('Forcing exit...');
        process.exit(0);
      }, 2000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start HTTP server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Start the server
try {
  startServer();
} catch (error) {
  logger.error('Unhandled error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

