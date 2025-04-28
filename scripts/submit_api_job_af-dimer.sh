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

# API_URL="http://localhost:3501/api/v1/external/jobs"
API_URL="https://bilbomd-nersc-dev.bl1231.als.lbl.gov/api/v1/external/jobs"


DAT_FILE="$SCRIPT_DIR/../test/data/af-dimer/xrcc4_dimer.dat"
SEQ_FILE="$SCRIPT_DIR/../test/data/af-dimer/entities.json"

RESPONSE_FILE=$(mktemp)
HTTP_STATUS=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  -X POST "$API_URL"/ \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=alphafold" \
  -F "title=API Test Job AF Dimer" \
  -F "dat_file=@${DAT_FILE}" \
  -F "entities_json=$(< "$SEQ_FILE")" )

echo "HTTP Status: $HTTP_STATUS"
jq . < "$RESPONSE_FILE" || cat "$RESPONSE_FILE"
rm "$RESPONSE_FILE"

