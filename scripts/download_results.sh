#!/bin/bash
#
# remember to export the BILBOMD_API_TOKEN variable before running this script
#
# export BILBOMD_API_TOKEN="your_api_token_here"
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -a
source "$SCRIPT_DIR/.env"
set +a

API_URL="http://localhost:3501/api/v1/external/jobs"

JOB_ID="$1"

if [ -z "$JOB_ID" ]; then
  echo "Usage: $0 <job_id>"
  exit 1
fi

echo "Fetching results for Job ID: $JOB_ID"

# Perform the request and capture both headers and binary body
RESPONSE=$(mktemp)
curl -s -i -L -X GET "${API_URL}/${JOB_ID}/results" \
  -H "Authorization: Bearer ${BILBOMD_API_TOKEN}" > "$RESPONSE"

# Extract headers and body separately
HEADER_END=$(awk '/^\r?$/{ print NR; exit }' "$RESPONSE")
BODY_START=$((HEADER_END + 1))

# Extract filename from headers
FILENAME=$(head -n "$HEADER_END" "$RESPONSE" | grep -i 'content-disposition' | sed -E 's/.*filename="?([^"]+)"?/\1/' | tr -d '\r')

if [ -n "$FILENAME" ]; then
  awk "NR >= $BODY_START" "$RESPONSE" > "$FILENAME"
  echo "✅ File saved as: $FILENAME"
else
  echo "⚠️ Could not determine filename from response headers."
  awk "NR >= $BODY_START" "$RESPONSE"
fi

rm -f "$RESPONSE"