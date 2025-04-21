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

# Replace with actual values
API_URL="http://localhost:3501/api/v1/external/jobs"

JOB_ID="$1"

if [ -z "$JOB_ID" ]; then
  echo "Usage: $0 <job_id>"
  exit 1
fi

curl -s -X GET "${API_URL}/${JOB_ID}/status" \
  -H "Authorization: Bearer ${BILBOMD_API_TOKEN}" \
  -H "Accept: application/json" | jq . || echo "Warning: 'jq' not installed. Raw response follows:"