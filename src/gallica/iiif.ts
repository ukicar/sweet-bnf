/**
 * IIIF (International Image Interoperability Framework) utilities
 * For accessing Gallica images and manifests
 */

import { IIIFImageOptions, PageInfo } from './types.js';
import { HttpClient } from './client.js';
import { logger } from '../logging.js';

/**
 * IIIF utilities for Gallica
 */
export class IIIFClient {
  private httpClient: HttpClient;
  private baseUrl: string;

  constructor(httpClient: HttpClient, baseUrl: string) {
    this.httpClient = httpClient;
    this.baseUrl = baseUrl;
  }

  /**
   * Get IIIF manifest URL for an ARK
   */
  getManifestUrl(ark: string): string {
    // Extract ARK identifier (remove ark:/12148/ prefix if present)
    const arkId = ark.replace(/^ark:\/12148\//, '').replace(/^\/ark:\/12148\//, '');
    return `${this.baseUrl}/iiif/ark:/12148/${arkId}/manifest.json`;
  }

  /**
   * Get IIIF image URL for a specific page
   */
  getImageUrl(ark: string, page: number, options: IIIFImageOptions = {}): string {
    // Extract ARK identifier
    const arkId = ark.replace(/^ark:\/12148\//, '').replace(/^\/ark:\/12148\//, '');
    
    const region = options.region || 'full';
    const size = options.size || 'full';
    const rotation = options.rotation !== undefined ? options.rotation : 0;
    const quality = options.quality || 'native';
    const format = options.format || 'jpg';

    return `${this.baseUrl}/iiif/ark:/12148/${arkId}/f${page}/${region}/${size}/${rotation}/${quality}.${format}`;
  }

  /**
   * Parse IIIF manifest to extract page information
   */
  async parseManifest(arkParam: string): Promise<{ pages: PageInfo[]; metadata: unknown }> {
    // Use a local variable to ensure type narrowing works correctly
    const arkIdentifier: string = arkParam;
    try {
      const manifestUrl = this.getManifestUrl(arkIdentifier);
      const manifest = await this.httpClient.getJson<{
        sequences?: Array<{
          canvases?: Array<{
            '@id'?: string;
            label?: string | { '@value'?: string };
            images?: Array<{
              resource?: {
                '@id'?: string;
                service?: {
                  '@id'?: string;
                };
              };
            }>;
            otherContent?: Array<{
              '@id'?: string;
            }>;
          }>;
        }>;
        metadata?: unknown;
      }>(manifestUrl);

      const pages: PageInfo[] = [];
      const sequences = manifest.sequences || [];
      
      for (const sequence of sequences) {
        const canvases = sequence.canvases || [];
        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i];
          if (!canvas) continue;
          
          const canvasId = canvas['@id'] || '';
          const label = typeof canvas.label === 'string' 
            ? canvas.label 
            : canvas.label?.['@value'] || `Page ${i + 1}`;
          
          // Extract image URL from canvas
          const imageResource = canvas.images?.[0]?.resource;
          const imageId = imageResource?.['@id'] || '';
          
          // Check if text/OCR is available
          const hasText = (canvas.otherContent?.length || 0) > 0;

          // Generate IIIF image URL from canvas ID or image resource
          let iiifImageUrl = '';
          if (imageId) {
            // Extract page number from image ID or canvas ID
            const pageMatch = (imageId || canvasId).match(/f(\d+)/);
            const pageNum = pageMatch ? parseInt(pageMatch[1]!, 10) : i + 1;
            iiifImageUrl = this.getImageUrl(arkIdentifier, pageNum);
          } else {
            // Fallback: use page number
            iiifImageUrl = this.getImageUrl(arkIdentifier, i + 1);
          }

          pages.push({
            page: i + 1,
            label,
            iiif_image_url: iiifImageUrl,
            has_text: hasText,
            thumbnail_url: this.getImageUrl(arkIdentifier, i + 1, { size: '200,' }),
          });
        }
      }

      return {
        pages,
        metadata: manifest.metadata || {},
      };
    } catch (error) {
      logger.error(`Error parsing IIIF manifest: ${error instanceof Error ? error.message : String(error)}`);
      return { pages: [], metadata: {} };
    }
  }
}

