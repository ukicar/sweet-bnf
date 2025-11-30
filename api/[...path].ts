/**
 * Vercel API route handler - catch-all route for MCP server
 * Vercel passes the path segments as req.query.path
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../src/httpServer.js';

export default async function vercelHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Reconstruct the URL path from Vercel's path parameter
  // The [...path] catch-all receives path segments as req.query.path (array)
  const pathSegments = req.query.path;
  let url = req.url || '/';
  
  // If path segments exist, reconstruct the URL
  if (pathSegments) {
    if (Array.isArray(pathSegments)) {
      url = '/' + pathSegments.join('/');
    } else if (typeof pathSegments === 'string') {
      url = '/' + pathSegments;
    }
  }
  
  // If URL doesn't start with /, add it
  if (!url.startsWith('/')) {
    url = '/' + url;
  }
  
  // Set the URL on the request object (Vercel's req is compatible with Node.js)
  (req as any).url = url;
  
  // Call the original handler - Vercel's req/res are compatible with Node.js types
  return handler(req as any, res as any);
}

