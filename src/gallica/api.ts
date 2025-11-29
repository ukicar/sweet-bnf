/**
 * Gallica API client - matches Python GallicaAPI class
 * Wrapper around HTTP client for SRU searches
 */

import { HttpClient } from './client.js';
import { SearchAPI } from './search.js';
import { config } from '../config.js';

/**
 * Gallica API client matching Python GallicaAPI
 */
export class GallicaAPI {
  private httpClient: HttpClient;
  public searchAPI: SearchAPI;

  constructor() {
    this.httpClient = new HttpClient(config.gallicaBaseUrl);
    this.searchAPI = new SearchAPI(this.httpClient, config.gallicaSruUrl);
  }

  /**
   * Get the HTTP client for direct access if needed
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }
}

