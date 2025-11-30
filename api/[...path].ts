/**
 * Vercel API route handler - catch-all route for MCP server
 * This file is needed for Vercel to recognize the serverless function
 */
import handler from '../src/httpServer.js';
export default handler;

