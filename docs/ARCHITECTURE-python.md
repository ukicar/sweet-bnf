# Python MCP Server Architecture Analysis

## Overview

This document provides a technical analysis of the Python MCP server for Gallica/BnF (`mcp-bibliotheque_nationale_de_France`).

## MCP Tools Exposed

The Python server exposes **8 MCP tools**:

### 1. `search_by_title`
- **Parameters:**
  - `title` (string, required): The title to search for
  - `exact_match` (boolean, optional, default: false): If true, search for exact title; otherwise, search for title containing the words
  - `max_results` (int, optional, default: 10): Maximum number of results (1-50)
  - `start_record` (int, optional, default: 1): Starting record for pagination
- **Behavior:** Constructs CQL query `dc.title all "title"` (exact) or `dc.title all title` (contains)
- **Returns:** SearchResult with metadata and records array

### 2. `search_by_author`
- **Parameters:**
  - `author` (string, required)
  - `exact_match` (boolean, optional, default: false)
  - `max_results` (int, optional, default: 10)
  - `start_record` (int, optional, default: 1)
- **Behavior:** CQL query `dc.creator all "author"` (exact) or `dc.creator all author` (contains)
- **Returns:** SearchResult

### 3. `search_by_subject`
- **Parameters:**
  - `subject` (string, required)
  - `exact_match` (boolean, optional, default: false)
  - `max_results` (int, optional, default: 10)
  - `start_record` (int, optional, default: 1)
- **Behavior:** CQL query `dc.subject all "subject"` (exact) or `dc.subject all subject` (contains)
- **Returns:** SearchResult

### 4. `search_by_date`
- **Parameters:**
  - `date` (string, required): Format YYYY, YYYY-MM, or YYYY-MM-DD
  - `max_results` (int, optional, default: 10)
  - `start_record` (int, optional, default: 1)
- **Behavior:** CQL query `dc.date all "{date}"`
- **Returns:** SearchResult

### 5. `search_by_document_type`
- **Parameters:**
  - `doc_type` (string, required): e.g., "monographie", "periodique", "image", "manuscrit", "carte", "musique"
  - `max_results` (int, optional, default: 10)
  - `start_record` (int, optional, default: 1)
- **Behavior:** CQL query `dc.type all "{doc_type}"`
- **Returns:** SearchResult

### 6. `advanced_search`
- **Parameters:**
  - `query` (string, required): Custom CQL query string
  - `max_results` (int, optional, default: 10)
  - `start_record` (int, optional, default: 1)
- **Behavior:** Passes CQL query directly to SRU API
- **Returns:** SearchResult

### 7. `natural_language_search`
- **Parameters:**
  - `query` (string, required): Natural language search query
  - `max_results` (int, optional, default: 10)
  - `start_record` (int, optional, default: 1)
- **Behavior:** CQL query `gallica all "{query}"` - searches across all fields
- **Returns:** SearchResult

### 8. `sequential_reporting`
- **Parameters:** Complex stateful tool with multiple modes:
  - **Initialization:** `topic`, `page_count?`, `source_count?`, `include_graphics?`
  - **Search sources:** `search_sources: true`
  - **Section creation:** `section_number`, `total_sections`, `title`, `content`, `is_bibliography?`, `sources_used?`, `next_section_needed?`
- **Behavior:** Multi-step sequential report generation:
  1. Initialize with topic → creates plan
  2. Search for sources → natural_language_search + search_by_subject
  3. Search graphics (if requested) → advanced_search for images/maps with fallbacks
  4. Create bibliography section
  5. Write content sections sequentially
- **Returns:** JSON strings in content array with state information

## Resources and Prompts

- No resources defined
- No prompts defined
- Sequential reporting uses internal state management

## Gallica API Interaction

### Base URLs
- **SRU API:** `https://gallica.bnf.fr/SRU`
- **Base URL:** `https://gallica.bnf.fr`

### SRU Search Endpoint
- **URL:** `https://gallica.bnf.fr/SRU`
- **Method:** GET
- **Parameters:**
  - `version`: "1.2"
  - `operation`: "searchRetrieve"
  - `query`: CQL query string
  - `startRecord`: Starting record (1-based)
  - `maximumRecords`: Maximum records (max 50)

### CQL Query Syntax
- **Fields:** `dc.title`, `dc.creator`, `dc.subject`, `dc.date`, `dc.type`, `dc.language`, `dc.collection`
- **Operators:** `all` (contains), `any` (any word)
- **Exact match:** Use quotes: `dc.title all "exact title"`
- **Contains:** No quotes: `dc.title all title words`
- **Natural language:** `gallica all "query"` searches across all fields
- **Combinations:** Use `and`, `or`: `dc.creator all "Victor Hugo" and dc.type all "monographie"`

### Response Format
- **Format:** XML with SRU namespaces
- **Namespaces:**
  - `srw`: `http://www.loc.gov/zing/srw/`
  - `dc`: `http://purl.org/dc/elements/1.1/`
  - `oai_dc`: `http://www.openarchives.org/OAI/2.0/oai_dc/`
- **Structure:**
  ```xml
  <srw:searchRetrieveResponse>
    <srw:numberOfRecords>...</srw:numberOfRecords>
    <srw:records>
      <srw:record>
        <srw:recordData>
          <oai_dc:dc>
            <dc:title>...</dc:title>
            <dc:creator>...</dc:creator>
            ...
          </oai_dc:dc>
        </srw:recordData>
      </srw:record>
    </srw:records>
  </srw:searchRetrieveResponse>
  ```

### ARK Identifiers
- **Format:** `ark:/12148/{identifier}`
- **Full URL:** `https://gallica.bnf.fr/ark:/12148/{identifier}`
- **Extraction:** From `dc:identifier` field in search results
- **Usage:** Stable identifier for documents, used to construct URLs

### IIIF and Image Endpoints
- **Not used in Python version** - only ARK URLs are extracted
- **Potential:** IIIF manifests at `https://gallica.bnf.fr/iiif/ark:/12148/{ark}/manifest.json`
- **Potential:** IIIF images at `https://gallica.bnf.fr/iiif/ark:/12148/{ark}/f{page}/{region}/{size}/{rotation}/{quality}.{format}`

### Text/OCR Endpoints
- **Not used in Python version**
- **Potential:** ALTO XML at `https://gallica.bnf.fr/RequestDigitalElement?O={ark}&E=ALTO&Deb={page}`
- **Potential:** Plain text at `https://gallica.bnf.fr/ark:/12148/{ark}.texteBrut`

## Sequential Reporting Workflow

### Step 1: Initialization
- User provides: `topic`, optional `page_count`, `source_count`, `include_graphics`
- Server creates: plan with section structure based on page_count
- Returns: JSON with topic, plan, nextStep: "Search for sources..."

### Step 2: Search Sources
- User provides: `search_sources: true`
- Server performs:
  1. `natural_language_search(topic, source_count)`
  2. If not enough results: `search_by_subject(topic, remaining_count)`
- Returns: JSON with sources array, graphics (if requested), nextStep: "Create bibliography section"

### Step 3: Create Bibliography
- User provides: `section_number: 1`, `is_bibliography: true`, `title: "Bibliography"`, `content: "..."`, `sources_used: [...]`
- Server: Adds section to report_sections, formats citations
- Returns: JSON with progress, nextStep: "Create section 2: Introduction"

### Step 4: Write Content Sections
- User provides: `section_number`, `total_sections`, `title`, `content`, `sources_used`, `next_section_needed`
- Server: Adds section, updates plan.current_section, calculates progress
- Returns: JSON with progress, nextStep for next section

### Step 5: Complete Report
- User provides: `next_section_needed: false` on final section
- Server: Marks report as complete
- Returns: JSON with nextStep: "Report complete"

### Graphics Search Strategy
1. Try: `gallica all "{mainKeyword}" and dc.type all "image"`
2. Fallback: `gallica all "{fullTopic}" and dc.type all "image"`
3. Try: `gallica all "{mainKeyword}" and dc.type all "carte"`
4. Fallback: `gallica all "{fullTopic}" and dc.type all "carte"`
5. Final fallback: `gallica all "{mainKeyword}" and (dc.type all "image" or dc.type all "carte" or dc.type all "estampe")`
6. If still no results: Create placeholder graphics with Gallica logo

### Citation Formatting
- **Monographs/Books:** `{creator}. ({date}). {title}. {publisher}. Retrieved from {url}`
- **Periodicals/Articles:** `{creator}. ({date}). {title}. Retrieved from {url}`
- **Other:** Same as monographs

## Assumptions, Limitations, and Shortcuts

### Assumptions
1. **SRU API stability:** Assumes SRU API structure remains consistent
2. **XML parsing:** Relies on ElementTree XML parsing, assumes consistent namespace usage
3. **ARK format:** Assumes ARK identifiers follow `ark:/12148/{id}` pattern
4. **Pagination:** Assumes startRecord is 1-based and maximumRecords is capped at 50

### Limitations
1. **No item metadata retrieval:** Only uses search results, no OAI-PMH or IIIF manifest fetching
2. **No page enumeration:** Cannot list pages of a document
3. **No image URL generation:** Only extracts ARK URLs, doesn't generate IIIF image URLs
4. **No OCR/text retrieval:** Cannot fetch OCR text or TEI content
5. **Simple graphics search:** Uses basic keyword extraction, no advanced relevance ranking
6. **No rate limiting:** No explicit rate limiting or backoff strategy
7. **Error handling:** Basic error handling, returns error in result dict rather than raising exceptions

### Shortcuts
1. **Graphics placeholders:** Creates placeholder graphics with Gallica logo when none found
2. **Simple relevance:** Graphics relevance based on title keyword matching
3. **Section plan:** Fixed section structure based on page_count, not dynamic
4. **Citation format:** Simple string formatting, no advanced bibliographic standards
5. **State management:** Uses function attributes for state (not thread-safe)

## Dependencies
- `requests==2.31.0` - HTTP client
- `fastmcp==0.1.0` - MCP server framework

## File Structure
```
mcp-bnf/
├── bnf_server.py              # MCP server entry point
├── requirements.txt
└── bnf_api/
    ├── __init__.py
    ├── api.py                  # GallicaAPI class
    ├── search.py               # SearchAPI class
    ├── config.py               # Constants
    └── sequential_reporting.py # SequentialReportingServer class
```

