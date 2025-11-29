/**
 * Text/OCR utilities for Gallica
 * Handles ALTO XML parsing and plain text extraction
 */

import { XMLParser } from 'fast-xml-parser';
// Text client for retrieving OCR and text content
import { HttpClient } from './client.js';
import { logger } from '../logging.js';

/**
 * Text client for retrieving OCR and text content
 */
export class TextClient {
  private httpClient: HttpClient;
  private baseUrl: string;

  constructor(httpClient: HttpClient, baseUrl: string) {
    this.httpClient = httpClient;
    this.baseUrl = baseUrl;
  }

  /**
   * Get page text in various formats
   */
  async getPageText(
    ark: string,
    page: number,
    format: 'plain' | 'alto' | 'tei' = 'plain'
  ): Promise<string | null> {
    try {
      if (format === 'alto') {
        return await this.getAltoText(ark, page);
      } else if (format === 'tei') {
        return await this.getTeiText(ark, page);
      } else {
        return await this.getPlainText(ark, page);
      }
    } catch (error) {
      logger.debug(`Text not available for ${ark}, page ${page}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get ALTO XML and extract text
   */
  private async getAltoText(ark: string, page: number): Promise<string | null> {
    try {
      // Extract ARK identifier
      const arkId = ark.replace(/^ark:\/12148\//, '').replace(/^\/ark:\/12148\//, '');
      
      const url = `${this.baseUrl}/RequestDigitalElement`;
      const params = {
        O: `ark:/12148/${arkId}`,
        E: 'ALTO',
        Deb: String(page),
      };

      const xmlBody = await this.httpClient.getXml(url, params);
      return this.parseAltoXml(xmlBody);
    } catch (error) {
      // ALTO not available, return null (not an error)
      return null;
    }
  }

  /**
   * Parse ALTO XML to extract text content
   */
  private parseAltoXml(xmlBody: string): string {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
      });

      const result = parser.parse(xmlBody);
      
      // Navigate ALTO structure
      const alto = result.alto || result.ALTO;
      if (!alto) {
        return '';
      }

      const layout = alto.Layout || alto.layout;
      if (!layout) {
        return '';
      }

      const page = layout.Page || layout.page;
      if (!page) {
        return '';
      }

      const printSpace = page.PrintSpace || page.printSpace || page.PrintSpace;
      if (!printSpace) {
        return '';
      }

      // Extract text blocks
      const textBlocks: string[] = [];
      const textBlocksArray = printSpace.TextBlock || printSpace.textBlock || [];
      const blocks = Array.isArray(textBlocksArray) ? textBlocksArray : textBlocksArray ? [textBlocksArray] : [];

      for (const block of blocks) {
        const textLines = block.TextLine || block.textLine || [];
        const lines = Array.isArray(textLines) ? textLines : textLines ? [textLines] : [];

        for (const line of lines) {
          const strings = line.String || line.string || [];
          const stringArray = Array.isArray(strings) ? strings : strings ? [strings] : [];

          const lineText = stringArray
            .map((s: unknown) => {
              if (typeof s === 'string') return s;
              if (s && typeof s === 'object' && '#text' in s) return String(s['#text']);
              if (s && typeof s === 'object' && '@_CONTENT' in s) return String(s['@_CONTENT']);
              return String(s);
            })
            .filter((t: string) => t.trim().length > 0)
            .join(' ');

          if (lineText.trim()) {
            textBlocks.push(lineText.trim());
          }
        }
      }

      return textBlocks.join('\n');
    } catch (error) {
      logger.warn(`Error parsing ALTO XML: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * Get plain text (fallback method)
   */
  private async getPlainText(ark: string, _page: number): Promise<string | null> {
    try {
      // Extract ARK identifier
      const arkId = ark.replace(/^ark:\/12148\//, '').replace(/^\/ark:\/12148\//, '');
      
      // Try plain text endpoint
      const url = `${this.baseUrl}/ark:/12148/${arkId}.texteBrut`;
      const text = await this.httpClient.get(url);
      
      if (text.statusCode === 200 && text.body.trim().length > 0) {
        // If we have page-specific text, extract relevant portion
        // For now, return full text (page extraction would require parsing)
        return text.body;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get TEI text (if available)
   */
  private async getTeiText(_ark: string, _page: number): Promise<string | null> {
    // TEI format similar to ALTO but different structure
    // For now, return null - can be implemented if needed
    return null;
  }
}

