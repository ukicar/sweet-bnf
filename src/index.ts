#!/usr/bin/env node
/**
 * MCP Server entry point for STDIO mode
 */

import { startMCPServer } from './mcpServer.js';
import { logger } from './logging.js';

/**
 * Main entry point
 */
async function main() {
  try {
    await startMCPServer();
  } catch (error) {
    logger.error('Failed to start MCP server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Unhandled error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

