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

# echo "API token: ${BILBOMD_API_TOKEN}"

API_URL="http://localhost:3501/api/v1/external/jobs"

# DAT_FILE="$SCRIPT_DIR/../test/data/af-mono/A_S_USP16-FL_1-FAIL.dat"
DAT_FILE="$SCRIPT_DIR/../test/data/af-mono/A_S_USP16-FL_1.dat"
# DAT_FILE="$SCRIPT_DIR/../test/data/af-mono/A S USP16 FL 1.dat"
# DAT_FILE="$SCRIPT_DIR/../test/data/af-mono/A_S_USP16-FL_1-copy-superlong-filename.dat"
SEQ_FILE="$SCRIPT_DIR/../test/data/af-mono/entities.json"

curl -X POST "$API_URL" \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=alphafold" \
  -F "title=API Test Job AF Monomer" \
  -F "dat_file=@${DAT_FILE}" \
  -F "entities_json=$(< "$SEQ_FILE")" | jq . || echo "Warning: 'jq' not installed. Raw response follows:"

