# Gallica/BnF API Documentation

## Overview

This document details the Gallica/BnF APIs used by the MCP server, based on analysis of the Python implementation and public documentation.

## SRU Search API

### Endpoint
- **URL:** `https://gallica.bnf.fr/SRU`
- **Method:** GET
- **Protocol:** SRU (Search/Retrieve via URL) version 1.2

### Parameters
- `version` (required): "1.2"
- `operation` (required): "searchRetrieve"
- `query` (required): CQL (Contextual Query Language) query string
- `startRecord` (optional, default: 1): Starting record number (1-based)
- `maximumRecords` (optional, default: 10, max: 50): Maximum number of records to return

### CQL Query Syntax

#### Fields
- `dc.title` - Document title
- `dc.creator` - Author/creator
- `dc.subject` - Subject/keywords
- `dc.date` - Publication date
- `dc.type` - Document type (monographie, periodique, image, manuscrit, carte, musique, etc.)
- `dc.language` - Language code (e.g., "fre", "eng")
- `dc.collection` - Collection identifier
- `gallica` - Special field that searches across all metadata fields

#### Operators
- `all` - All words must be present (contains)
- `any` - Any word may be present
- `exact` - Exact phrase match
- `adj` - Adjacent words

#### Query Examples
```
# Exact title match
dc.title all "Les Misérables"

# Title contains words
dc.title all Victor Hugo

# Author and type combination
dc.creator all "Victor Hugo" and dc.type all "monographie"

# Date range (approximate)
dc.date all "1862"

# Natural language search across all fields
gallica all "impressionnisme français"

# Complex query
dc.subject all "Paris" and dc.type all "carte" and dc.date all "19"
```

### Response Format

**Content-Type:** `application/xml`

**Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:version>1.2</srw:version>
  <srw:numberOfRecords>1234</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordSchema>info:srw/schema/1/dc-v1.1</srw:recordSchema>
      <srw:recordPacking>xml</srw:recordPacking>
      <srw:recordData>
        <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                   xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Document Title</dc:title>
          <dc:creator>Author Name</dc:creator>
          <dc:date>1862</dc:date>
          <dc:type>monographie</dc:type>
          <dc:identifier>https://gallica.bnf.fr/ark:/12148/bpt6k123456</dc:identifier>
          <!-- More Dublin Core fields -->
        </oai_dc:dc>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>
```

### Dublin Core Fields Extracted
- `dc:title` - Title(s)
- `dc:creator` - Creator(s)/Author(s)
- `dc:contributor` - Contributor(s)
- `dc:publisher` - Publisher(s)
- `dc:date` - Publication date(s)
- `dc:description` - Description(s)
- `dc:type` - Document type(s)
- `dc:format` - Format(s)
- `dc:identifier` - Identifier(s) - includes ARK URLs
- `dc:source` - Source(s)
- `dc:language` - Language(s)
- `dc:relation` - Relation(s)
- `dc:coverage` - Coverage
- `dc:rights` - Rights
- `dc:subject` - Subject(s)

## ARK Identifiers

### Format
- **Pattern:** `ark:/12148/{identifier}`
- **Example:** `ark:/12148/bpt6k123456`
- **Full URL:** `https://gallica.bnf.fr/ark:/12148/bpt6k123456`

### Usage
- Stable identifier for documents in Gallica
- Used to construct URLs for viewing documents
- Extracted from `dc:identifier` field in search results
- Can be used with IIIF and other APIs

## OAI-PMH Metadata API

### Endpoint
- **URL:** `https://gallica.bnf.fr/services/OAIRecord?ark={ark}`
- **Method:** GET
- **Protocol:** OAI-PMH (Open Archives Initiative Protocol for Metadata Harvesting)

### Parameters
- `ark` (required): ARK identifier (e.g., "ark:/12148/bpt6k123456")

### Response
- XML format with Dublin Core metadata
- More detailed metadata than SRU search results
- Used for extended item details (not in Python version)

## IIIF (International Image Interoperability Framework)

### Manifest Endpoint
- **URL:** `https://gallica.bnf.fr/iiif/ark:/12148/{ark}/manifest.json`
- **Method:** GET
- **Format:** JSON (IIIF Presentation API 2.1)

### Manifest Structure
```json
{
  "@context": "http://iiif.io/api/presentation/2/context.json",
  "@type": "sc:Manifest",
  "@id": "https://gallica.bnf.fr/iiif/ark:/12148/bpt6k123456/manifest.json",
  "label": "Document Title",
  "metadata": [...],
  "sequences": [{
    "canvases": [{
      "@id": "...",
      "label": "Page 1",
      "images": [{
        "resource": {
          "@id": "https://gallica.bnf.fr/iiif/ark:/12148/bpt6k123456/f1/full/full/0/native.jpg"
        }
      }]
    }]
  }]
}
```

### Image API Endpoint
- **URL Pattern:** `https://gallica.bnf.fr/iiif/ark:/12148/{ark}/f{page}/{region}/{size}/{rotation}/{quality}.{format}`
- **Method:** GET
- **Protocol:** IIIF Image API 2.1

### Image URL Parameters
- `{ark}` - ARK identifier (without `ark:/12148/` prefix)
- `f{page}` - Page number (e.g., `f1`, `f2`)
- `{region}` - Image region:
  - `full` - Entire image
  - `x,y,w,h` - Specific region (e.g., `100,100,500,500`)
- `{size}` - Image size:
  - `full` - Full size
  - `w,h` - Specific dimensions (e.g., `500,500`)
  - `w,` - Width only, height proportional
  - `,h` - Height only, width proportional
  - `pct:n` - Percentage (e.g., `pct:50`)
- `{rotation}` - Rotation angle: `0`, `90`, `180`, `270`
- `{quality}` - Image quality:
  - `default` - Default quality
  - `color` - Color
  - `gray` - Grayscale
  - `bitonal` - Bitonal
  - `native` - Native quality
- `{format}` - Image format: `jpg`, `png`, `webp`, etc.

### Example Image URLs
```
# Full page, full size
https://gallica.bnf.fr/iiif/ark:/12148/bpt6k123456/f1/full/full/0/native.jpg

# Thumbnail (200px width)
https://gallica.bnf.fr/iiif/ark:/12148/bpt6k123456/f1/full/200,/0/native.jpg

# Specific region, 500x500
https://gallica.bnf.fr/iiif/ark:/12148/bpt6k123456/f1/100,100,500,500/500,500/0/native.jpg
```

## Text/OCR APIs

### ALTO XML Endpoint
- **URL:** `https://gallica.bnf.fr/RequestDigitalElement?O={ark}&E=ALTO&Deb={page}`
- **Method:** GET
- **Parameters:**
  - `O` - ARK identifier (e.g., "ark:/12148/bpt6k123456")
  - `E` - Format: "ALTO"
  - `Deb` - Starting page number
- **Response:** ALTO XML with OCR text and coordinates

### ALTO XML Structure
```xml
<alto>
  <Layout>
    <Page>
      <PrintSpace>
        <TextBlock>
          <TextLine>
            <String CONTENT="Text content" />
          </TextLine>
        </TextBlock>
      </PrintSpace>
    </Page>
  </Layout>
</alto>
```

### Plain Text Endpoint
- **URL:** `https://gallica.bnf.fr/ark:/12148/{ark}.texteBrut`
- **Method:** GET
- **Response:** Plain text (entire document, not page-specific)

### TEI Endpoint
- **URL:** Similar to ALTO, with `E=TEI`
- **Format:** TEI XML
- **Availability:** Limited

## Document Types

Common document types in Gallica:
- `monographie` - Books/Monographs
- `periodique` - Periodicals/Newspapers
- `image` - Images
- `manuscrit` - Manuscripts
- `carte` - Maps
- `musique` - Music scores
- `objet` - Objects
- `video` - Videos
- `son` - Audio recordings
- `estampe` - Prints/Engravings

## Rate Limits and Usage Constraints

### Official Guidelines
- No explicit rate limits documented
- BnF reserves the right to restrict access for abusive usage
- Reasonable usage expected (not specified)

### Best Practices
- Implement retry logic with exponential backoff
- Cache results when possible
- Batch requests when appropriate
- Respect server response times
- Use appropriate timeouts (30s recommended)

## Error Handling

### HTTP Status Codes
- `200` - Success
- `400` - Bad request (invalid query)
- `404` - Not found
- `500` - Server error
- `503` - Service unavailable

### SRU Error Response
```xml
<srw:searchRetrieveResponse>
  <srw:version>1.2</srw:version>
  <srw:numberOfRecords>0</srw:numberOfRecords>
  <srw:diagnostics>
    <srw:diagnostic>
      <srw:uri>info:srw/diagnostic/1/4</srw:uri>
      <srw:message>Unsupported index</srw:message>
    </srw:diagnostic>
  </srw:diagnostics>
</srw:searchRetrieveResponse>
```

## Notes

1. **ARK Format:** Always use `ark:/12148/` prefix in URLs, but ARK identifier may be stored without prefix
2. **Page Numbers:** IIIF uses `f{page}` format (e.g., `f1`, `f2`), starting from 1
3. **Text Availability:** Not all documents have OCR text available
4. **IIIF Support:** Not all documents have IIIF manifests
5. **Language Codes:** Use ISO 639-2 codes (e.g., "fre", "eng", "deu")
6. **Date Formats:** Accepts YYYY, YYYY-MM, YYYY-MM-DD in searches

