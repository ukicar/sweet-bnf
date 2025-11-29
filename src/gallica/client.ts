/**
 * HTTP client for Gallica API with retry logic and error handling
 */

import { request } from 'undici';
import { config } from '../config.js';
import { logger } from '../logging.js';

export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
}

/**
 * Centralized HTTP client for Gallica API
 */
export class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private userAgent: string;

  constructor(baseUrl: string, options: HttpClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || config.httpTimeout;
    this.retries = options.retries || config.httpRetries;
    this.userAgent = 'node-mcp-bnf/1.0.0';
  }

  /**
   * Make HTTP GET request with retry logic
   */
  async get(
    url: string,
    params?: Record<string, string | number>
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
    // If url is already absolute, use it directly; otherwise resolve against baseUrl
    const fullUrl = url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url)
      : new URL(url, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        fullUrl.searchParams.set(key, String(value));
      }
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        logger.info(`[HTTP] GET request: ${fullUrl.toString()} (attempt ${attempt + 1}/${this.retries + 1})`);
        logger.debug(`[HTTP] Request params:`, params);

        const response = await request(fullUrl.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': this.userAgent,
            Accept: '*/*',
          },
          bodyTimeout: this.timeout,
        });

        const body = await response.body.text();
        logger.debug(`[HTTP] Response status: ${response.statusCode}`);
        logger.debug(`[HTTP] Response body length: ${body.length} bytes`);
        
        const headers: Record<string, string> = {};
        if (response.headers) {
          try {
            const headerEntries = Object.entries(response.headers);
            for (const [key, value] of headerEntries) {
              headers[key] = Array.isArray(value) ? value[0] || '' : (value || '');
            }
            logger.debug(`[HTTP] Response headers:`, headers);
          } catch {
            // Headers may not be iterable, skip
          }
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          logger.info(`[HTTP] Request successful: ${response.statusCode}`);
          return { statusCode: response.statusCode, body, headers };
        }

        // Don't retry on client errors (4xx)
        if (response.statusCode >= 400 && response.statusCode < 500) {
          throw new Error(
            `HTTP ${response.statusCode}: ${body.substring(0, 200)}`
          );
        }

        // Retry on server errors (5xx) or network errors
        lastError = new Error(`HTTP ${response.statusCode}: ${body.substring(0, 200)}`);
        if (attempt < this.retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`[HTTP] Request failed (${response.statusCode}), retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retries) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn(`[HTTP] Request error, retrying in ${delay}ms...`, lastError.message);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Make HTTP GET request and parse as JSON
   */
  async getJson<T>(url: string, params?: Record<string, string | number>): Promise<T> {
    const response = await this.get(url, params);
    try {
      return JSON.parse(response.body) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Make HTTP GET request and return XML body
   */
  async getXml(url: string, params?: Record<string, string | number>): Promise<string> {
    const response = await this.get(url, params);
    return response.body;
  }
}

