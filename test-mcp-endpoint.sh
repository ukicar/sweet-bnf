#!/bin/bash
# Test script to simulate ChatGPT's MCP requests

echo "Testing MCP endpoint locally..."
echo ""

# Test 1: GET /message to establish SSE connection
echo "Step 1: Establishing SSE connection (GET /message)..."
SESSION_OUTPUT=$(curl -s -N "http://localhost:3000/message" 2>&1 | head -5)
echo "$SESSION_OUTPUT"
echo ""

# Extract session ID from SSE output (format: event: endpoint\ndata: /message?sessionId=xxx)
SESSION_ID=$(echo "$SESSION_OUTPUT" | grep "sessionId=" | sed 's/.*sessionId=\([^ ]*\).*/\1/' | head -1)

if [ -z "$SESSION_ID" ]; then
  echo "Could not extract session ID. Trying without sessionId..."
  SESSION_ID=""
fi

echo "Session ID: $SESSION_ID"
echo ""

# Test 2: POST /message with tools/list
echo "Step 2: Testing tools/list..."
curl -v -X POST "http://localhost:3000/message${SESSION_ID:+?sessionId=$SESSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }' 2>&1 | head -30
echo ""
echo ""

# Test 3: POST /message with advanced_search
echo "Step 3: Testing advanced_search tool..."
curl -v -X POST "http://localhost:3000/message${SESSION_ID:+?sessionId=$SESSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "advanced_search",
      "arguments": {
        "query": "(dc.subject all \"poésie\") and (dc.type all \"monographie\") and (dc.language all \"fre\") and (dc.date >= \"1400\" and dc.date <= \"1499\")",
        "max_results": 10,
        "start_record": 1
      }
    }
  }' 2>&1 | head -50
echo ""

