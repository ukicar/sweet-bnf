# Node.js MCP Server Architecture

## Overview

This document describes the architecture and design of the TypeScript/Node.js MCP server for Gallica/BnF. The server faithfully reproduces all 8 Python tools and extends functionality with 4 additional tools for IIIF/images/text support.

## Project Structure

```
node-mcp-bnf/
├── src/
│   ├── index.ts                 # STDIO entry point
│   ├── httpServer.ts            # HTTP entry point (Vercel)
│   ├── mcpServer.ts             # MCP server initialization
│   ├── config.ts                # Configuration management
│   ├── logging.ts               # Logging utility
│   ├── tools/
│   │   ├── gallicaSearch.ts    # 7 search tools
│   │   ├── items.ts            # 4 extended item tools
│   │   └── reports.ts           # Sequential reporting tool
│   └── gallica/
│       ├── api.ts               # GallicaAPI class
│       ├── client.ts            # HTTP client with retries
│       ├── search.ts            # SearchAPI class
│       ├── items.ts             # ItemsClient (extended)
│       ├── iiif.ts              # IIIFClient (extended)
│       ├── text.ts              # TextClient (extended)
│       ├── sequential_reporting.ts # SequentialReportingServer
│       └── types.ts             # TypeScript type definitions
├── docs/
│   ├── ARCHITECTURE-python.md
│   ├── GALLICA-API-NOTES.md
│   └── ARCHITECTURE-node.md
├── tests/
│   └── unit/
│       ├── search.test.ts
│       ├── parsing.test.ts
│       ├── reports.test.ts
│       ├── iiif.test.ts
│       └── text.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Core Architecture

### Module Organization

#### 1. Core Infrastructure (`src/`)
- **`config.ts`**: Environment-based configuration with defaults matching Python constants
- **`logging.ts`**: Simple logger with configurable levels (error, warn, info, debug)
- **`index.ts`**: STDIO entry point for local usage
- **`httpServer.ts`**: HTTP/SSE entry point for Vercel deployment

#### 2. Gallica API Layer (`src/gallica/`)
- **`client.ts`**: Centralized HTTP client using `undici` with retry logic
- **`api.ts`**: `GallicaAPI` class - main API client wrapper
- **`search.ts`**: `SearchAPI` class - matches Python SearchAPI exactly
- **`types.ts`**: TypeScript interfaces matching Python data structures

#### 3. Extended Features (`src/gallica/`)
- **`items.ts`**: `ItemsClient` - item metadata and page enumeration (NEW)
- **`iiif.ts`**: `IIIFClient` - IIIF manifest and image URL generation (NEW)
- **`text.ts`**: `TextClient` - OCR/text retrieval (ALTO, plain text) (NEW)
- **`sequential_reporting.ts`**: `SequentialReportingServer` - matches Python exactly

#### 4. MCP Tools Layer (`src/tools/`)
- **`gallicaSearch.ts`**: 7 search tools matching Python
- **`items.ts`**: 4 extended item tools (NEW)
- **`reports.ts`**: Sequential reporting tool matching Python

#### 5. MCP Server (`src/mcpServer.ts`)
- Initializes all API clients
- Registers all 12 tools (8 Python + 4 extended)
- Handles tool calls with error handling
- Supports both STDIO and HTTP transports

## Design Principles

### 1. Faithful Reproduction
- All 8 Python tools replicated exactly
- Same parameter names, types, and behaviors
- Same response formats
- Same error handling patterns

### 2. Type Safety
- Strict TypeScript configuration
- Comprehensive type definitions
- No `any` types (use `unknown` where needed)
- Zod validation for tool inputs

### 3. Extensibility
- Clear separation of concerns
- Modular architecture
- Easy to add new tools or features
- Well-documented extension points

### 4. Error Handling
- Centralized HTTP error handling
- Retry logic with exponential backoff
- User-friendly error messages
- Graceful degradation

### 5. Performance
- Modern HTTP client (`undici`)
- Efficient XML parsing (`fast-xml-parser`)
- Minimal dependencies
- Fast startup time

## Key Components

### HTTP Client (`gallica/client.ts`)
- Uses `undici` for modern, fast HTTP requests
- Implements retry logic with exponential backoff
- Handles timeouts and errors gracefully
- Supports XML and JSON parsing

### Search API (`gallica/search.ts`)
- Matches Python `SearchAPI` class exactly
- 7 search methods with same signatures
- CQL query construction
- SRU XML parsing with namespace handling
- Dublin Core field extraction

### Sequential Reporting (`gallica/sequential_reporting.ts`)
- Stateful multi-step process
- Matches Python `SequentialReportingServer` exactly
- Source search with fallbacks
- Graphics search with multiple strategies
- Citation formatting by document type
- Progress tracking

### Extended Features
- **ItemsClient**: OAI-PMH metadata, IIIF manifest parsing, page enumeration
- **IIIFClient**: Manifest URL generation, image URL construction, page extraction
- **TextClient**: ALTO XML parsing, plain text extraction, format support

## MCP Tools

### Python Tools (8)
1. `search_by_title` - Search by title with exact match option
2. `search_by_author` - Search by author with exact match option
3. `search_by_subject` - Search by subject with exact match option
4. `search_by_date` - Search by date (YYYY, YYYY-MM, YYYY-MM-DD)
5. `search_by_document_type` - Search by document type
6. `advanced_search` - Custom CQL query
7. `natural_language_search` - Natural language search
8. `sequential_reporting` - Multi-step report generation

### Extended Tools (4)
9. `get_item_details` - Full item metadata
10. `get_item_pages` - Enumerate document pages
11. `get_page_image` - IIIF image URL generation
12. `get_page_text` - OCR/text retrieval

## Configuration

### Environment Variables
- `GALLICA_BASE_URL` - Base URL (default: `https://gallica.bnf.fr`)
- `GALLICA_SRU_URL` - SRU endpoint (default: `https://gallica.bnf.fr/SRU`)
- `LOG_LEVEL` - Logging level (default: `info`)
- `HTTP_TIMEOUT` - Request timeout in ms (default: 30000)
- `HTTP_RETRIES` - Max retries (default: 3)
- `DEFAULT_MAX_RECORDS` - Default max results (default: 10)
- `DEFAULT_START_RECORD` - Default start record (default: 1)

## Deployment

### Local (STDIO)
- Entry point: `src/index.ts`
- Usage: `npm start` or `node dist/index.js`
- Transport: STDIO (stdin/stdout)
- Configuration: Claude Desktop, Cursor MCP settings

### Vercel (HTTP/SSE)
- Entry point: `src/httpServer.ts`
- Transport: HTTP/SSE
- Configuration: `vercel.json` for routing
- Environment: Set env vars in Vercel dashboard

## Extension Points

### Adding New Search Methods
1. Add method to `SearchAPI` class in `gallica/search.ts`
2. Create tool function in `tools/gallicaSearch.ts`
3. Register tool in `mcpServer.ts`

### Adding New Item Features
1. Add method to appropriate client (`ItemsClient`, `IIIFClient`, `TextClient`)
2. Create tool function in `tools/items.ts`
3. Register tool in `mcpServer.ts`

### Customizing Sequential Reporting
1. Modify `SequentialReportingServer` in `gallica/sequential_reporting.ts`
2. Update tool schema in `tools/reports.ts` if needed
3. Test with various topics and configurations

## Testing Strategy

### Unit Tests
- Search parameter mapping
- SRU XML parsing
- Sequential reporting state management
- IIIF URL generation
- ALTO XML parsing

### Integration Tests
- Real API calls (with rate limiting)
- End-to-end tool execution
- Error scenarios

### Test Fixtures
- SRU XML samples
- IIIF manifest samples
- ALTO XML samples

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `undici` - Modern HTTP client
- `zod` - Input validation
- `fast-xml-parser` - XML parsing

### Development
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution
- `vitest` - Testing framework
- `@types/node` - Node.js type definitions

## Performance Considerations

1. **HTTP Client**: `undici` is faster than `node-fetch` or `axios`
2. **XML Parsing**: `fast-xml-parser` is efficient for large responses
3. **Retry Logic**: Exponential backoff prevents overwhelming the API
4. **Caching**: Consider adding response caching for frequently accessed items
5. **Connection Pooling**: `undici` handles connection pooling automatically

## Security Considerations

1. **Input Validation**: All tool inputs validated with Zod
2. **URL Validation**: ARK identifiers validated before use
3. **Error Messages**: Don't expose internal errors to clients
4. **Rate Limiting**: Respect Gallica API usage guidelines
5. **HTTPS Only**: All API calls use HTTPS

## Future Enhancements

1. **Response Caching**: Cache search results and metadata
2. **Batch Operations**: Support batch item retrieval
3. **Advanced Filtering**: More sophisticated source selection
4. **Image Processing**: Support for image transformations
5. **TEI Support**: Full TEI XML parsing
6. **WebSocket Support**: Real-time updates for long operations
7. **Metrics**: Add performance metrics and monitoring

