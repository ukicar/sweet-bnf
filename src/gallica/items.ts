/**
 * Item metadata and page enumeration utilities
 * Extended features not in Python version
 */

import { ItemMetadata, PageInfo } from './types.js';
import { HttpClient } from './client.js';
import { IIIFClient } from './iiif.js';
import { logger } from '../logging.js';

/**
 * Items client for metadata and page access
 */
export class ItemsClient {
  private iiifClient: IIIFClient;
  private baseUrl: string;

  constructor(_httpClient: HttpClient, iiifClient: IIIFClient, baseUrl: string) {
    this.iiifClient = iiifClient;
    this.baseUrl = baseUrl;
  }

  /**
   * Get full item metadata
   */
  async getItemMetadata(ark: string): Promise<ItemMetadata> {
    // Extract ARK identifier
    const arkId = ark.replace(/^ark:\/12148\//, '').replace(/^\/ark:\/12148\//, '');
    const fullArk = `ark:/12148/${arkId}`;
    const gallicaUrl = `${this.baseUrl}/ark:/12148/${arkId}`;

    try {
      // Try to get metadata from IIIF manifest first
      if (!ark) {
        throw new Error('ARK is required');
      }
      const manifest = await this.iiifClient.parseManifest(ark);
      
      // Extract metadata from manifest if available
      const metadata = manifest.metadata as Record<string, unknown> || {};
      
      // Build metadata object
      const itemMetadata: ItemMetadata = {
        ark: fullArk,
        gallica_url: gallicaUrl,
        manifest_url: this.iiifClient.getManifestUrl(ark),
        available_formats: ['iiif', 'image'],
        ...this.extractMetadataFromManifest(metadata),
      };

      // Check if text is available
      if (manifest.pages.length > 0 && manifest.pages[0]?.has_text) {
        itemMetadata.available_formats.push('text', 'alto');
      }

      return itemMetadata;
    } catch (error) {
      logger.warn(`Could not fetch full metadata for ${ark}, returning basic info: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return basic metadata
      return {
        ark: fullArk,
        gallica_url: gallicaUrl,
        manifest_url: this.iiifClient.getManifestUrl(ark),
        available_formats: ['iiif', 'image'],
      };
    }
  }

  /**
   * Extract metadata from IIIF manifest metadata array
   */
  private extractMetadataFromManifest(metadata: Record<string, unknown>): Partial<ItemMetadata> {
    const result: Partial<ItemMetadata> = {};

    if (Array.isArray(metadata)) {
      for (const item of metadata) {
        if (item && typeof item === 'object' && 'label' in item && 'value' in item) {
          const label = String(item.label || '');
          const value = item.value;
          
          if (label.toLowerCase().includes('title')) {
            result.title = String(value);
          } else if (label.toLowerCase().includes('creator') || label.toLowerCase().includes('author')) {
            result.creator = String(value);
          } else if (label.toLowerCase().includes('date')) {
            result.date = String(value);
          } else if (label.toLowerCase().includes('publisher')) {
            result.publisher = String(value);
          } else if (label.toLowerCase().includes('description')) {
            result.description = String(value);
          } else if (label.toLowerCase().includes('type')) {
            result.type = String(value);
          } else if (label.toLowerCase().includes('language')) {
            result.language = String(value);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get item pages with options
   */
  async getItemPages(
    ark: string,
    options?: {
      page?: number;
      pageSize?: number;
      range?: [number, number];
    }
  ): Promise<PageInfo[]> {
    if (!ark) {
      return [];
    }
    try {
      const manifest = await this.iiifClient.parseManifest(ark);
      let pages = manifest.pages;

      // Apply filters
      if (options?.range) {
        const [start, end] = options.range;
        pages = pages.filter((p) => p.page >= start && p.page <= end);
      } else if (options?.page !== undefined) {
        // Get single page
        const page = pages.find((p) => p.page === options.page);
        return page ? [page] : [];
      } else if (options?.pageSize !== undefined) {
        // Get first N pages
        pages = pages.slice(0, options.pageSize);
      }

      return pages;
    } catch (error) {
      logger.error(`Error getting pages for ${ark}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}

