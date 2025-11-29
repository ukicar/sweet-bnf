/**
 * Search utilities for the Gallica BnF API
 * Matches Python SearchAPI class functionality
 */

import { XMLParser } from 'fast-xml-parser';
import { HttpClient } from './client.js';
import { SearchResult } from './types.js';
import { config } from '../config.js';
import { logger } from '../logging.js';

/**
 * Search API matching Python SearchAPI class
 */
export class SearchAPI {
  private httpClient: HttpClient;
  private sruUrl: string;

  constructor(httpClient: HttpClient, sruUrl: string) {
    this.httpClient = httpClient;
    this.sruUrl = sruUrl;
  }

  /**
   * Core search method - matches Python GallicaAPI.search
   */
  private async search(
    query: string,
    startRecord: number = config.defaultStartRecord,
    maxRecords: number = config.defaultMaxRecords
  ): Promise<SearchResult> {
    logger.info(`[SEARCH] Executing search query: "${query}" (startRecord: ${startRecord}, maxRecords: ${maxRecords})`);
    const params = {
      version: '1.2',
      operation: 'searchRetrieve',
      query,
      startRecord: String(startRecord),
      maximumRecords: String(Math.min(maxRecords, 50)), // Cap at 50 like Python
    };

    try {
      logger.debug(`[SEARCH] Calling Gallica SRU API with params:`, params);
      const xmlBody = await this.httpClient.getXml(this.sruUrl, params);
      logger.debug(`[SEARCH] Received XML response, length: ${xmlBody.length} bytes`);
      const result = this.parseSruResponse(xmlBody, query);
      logger.info(`[SEARCH] Search completed: ${result.records.length} records returned out of ${result.metadata.total_records} total`);
      return result;
    } catch (error) {
      logger.error(`[SEARCH] Error during Gallica API request: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`[SEARCH] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      return {
        metadata: {
          query,
          total_records: '0',
          records_returned: 0,
          date_retrieved: new Date().toISOString().replace('T', ' ').substring(0, 19),
        },
        records: [],
        error: error instanceof Error ? error.message : String(error),
        parameters: params,
      };
    }
  }

  /**
   * Parse SRU XML response - matches Python parsing logic
   */
  private parseSruResponse(xmlBody: string, query: string): SearchResult {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
      });

      const result = parser.parse(xmlBody);

      // Navigate through SRU response structure
      const sruResponse = result['srw:searchRetrieveResponse'] || result.searchRetrieveResponse;
      if (!sruResponse) {
        throw new Error('Invalid SRU response structure');
      }

      const numberOfRecords = sruResponse['srw:numberOfRecords']?.['#text'] || 
                              sruResponse.numberOfRecords?.['#text'] ||
                              sruResponse['srw:numberOfRecords'] ||
                              sruResponse.numberOfRecords ||
                              '0';

      const records = sruResponse['srw:records']?.['srw:record'] || 
                     sruResponse.records?.record ||
                     [];

      const recordsArray = Array.isArray(records) ? records : records ? [records] : [];

      const parsedRecords: Array<Record<string, string | string[] | undefined>> = [];

      for (const record of recordsArray) {
        const recordData = record['srw:recordData']?.['oai_dc:dc'] ||
                          record.recordData?.['oai_dc:dc'] ||
                          record['srw:recordData'] ||
                          record.recordData;

        if (!recordData) continue;

        const recordDict: Record<string, string | string[] | undefined> = {};

        // Extract Dublin Core fields
        const dcFields = [
          'title', 'creator', 'contributor', 'publisher', 'date',
          'description', 'type', 'format', 'identifier', 'source',
          'language', 'relation', 'coverage', 'rights', 'subject',
        ];

        for (const field of dcFields) {
          const elements = recordData[`dc:${field}`] || recordData[field];
          if (elements) {
            const values = Array.isArray(elements) ? elements : [elements];
            const textValues = values
              .map((v: unknown) => {
                if (typeof v === 'string') return v.trim();
                if (v && typeof v === 'object' && '#text' in v) return String(v['#text']).trim();
                return String(v).trim();
              })
              .filter((v: string) => v.length > 0);

            if (textValues.length > 0) {
              const value: string | string[] = textValues.length === 1 ? textValues[0]! : textValues;
              recordDict[field] = value;
            }
          }
        }

        // Extract Gallica URL from identifiers
        const identifiers = recordDict.identifier;
        if (identifiers) {
          const idArray = Array.isArray(identifiers) ? identifiers : [identifiers];
          for (const identifier of idArray) {
            if (typeof identifier === 'string' && identifier.includes('gallica.bnf.fr/ark:')) {
              recordDict.gallica_url = identifier;
              break;
            }
          }
        }

        parsedRecords.push(recordDict);
      }

      return {
        metadata: {
          query,
          total_records: String(numberOfRecords),
          records_returned: parsedRecords.length,
          date_retrieved: new Date().toISOString().replace('T', ' ').substring(0, 19),
        },
        records: parsedRecords,
      };
    } catch (error) {
      logger.error(`Error parsing XML response: ${error instanceof Error ? error.message : String(error)}`);
      return {
        metadata: {
          query,
          total_records: '0',
          records_returned: 0,
          date_retrieved: new Date().toISOString().replace('T', ' ').substring(0, 19),
        },
        records: [],
        error: `XML parsing error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Search by title - matches Python search_by_title
   */
  searchByTitle(
    title: string,
    exactMatch: boolean = false,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    const query = exactMatch ? `dc.title all "${title}"` : `dc.title all ${title}`;
    return this.search(query, startRecord, maxResults);
  }

  /**
   * Search by author - matches Python search_by_author
   */
  searchByAuthor(
    author: string,
    exactMatch: boolean = false,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    const query = exactMatch ? `dc.creator all "${author}"` : `dc.creator all ${author}`;
    return this.search(query, startRecord, maxResults);
  }

  /**
   * Search by subject - matches Python search_by_subject
   */
  searchBySubject(
    subject: string,
    exactMatch: boolean = false,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    const query = exactMatch ? `dc.subject all "${subject}"` : `dc.subject all ${subject}`;
    return this.search(query, startRecord, maxResults);
  }

  /**
   * Search by date - matches Python search_by_date
   * Accepts YYYY, YYYY-MM, or YYYY-MM-DD format
   */
  searchByDate(
    date: string,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    const query = `dc.date all "${date}"`;
    return this.search(query, startRecord, maxResults);
  }

  /**
   * Search by document type - matches Python search_by_document_type
   */
  searchByDocumentType(
    docType: string,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    const query = `dc.type all "${docType}"`;
    return this.search(query, startRecord, maxResults);
  }

  /**
   * Advanced search with custom CQL - matches Python advanced_search
   */
  advancedSearch(
    query: string,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    return this.search(query, startRecord, maxResults);
  }

  /**
   * Natural language search - matches Python natural_language_search
   */
  naturalLanguageSearch(
    query: string,
    maxResults: number = config.defaultMaxRecords,
    startRecord: number = config.defaultStartRecord
  ): Promise<SearchResult> {
    const formattedQuery = `gallica all "${query}"`;
    return this.search(formattedQuery, startRecord, maxResults);
  }
}

