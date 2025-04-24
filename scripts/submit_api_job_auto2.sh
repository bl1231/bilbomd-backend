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


PDB_FILE="$SCRIPT_DIR/../test/data/auto2/af-p13188-f1-model_v4.pdb"
DAT_FILE="$SCRIPT_DIR/../test/data/auto2/gln4_01e_trim.dat"
PAE_FILE="$SCRIPT_DIR/../test/data/auto2/af-p13188-f1-pae_v4.json"

RESPONSE_FILE=$(mktemp)
HTTP_STATUS=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=auto" \
  -F "title=API Test Job Auto2" \
  -F "pdb_file=@${PDB_FILE}" \
  -F "dat_file=@${DAT_FILE}" \
  -F "pae_file=@${PAE_FILE}")



echo "HTTP Status: $HTTP_STATUS"
jq . < "$RESPONSE_FILE" || cat "$RESPONSE_FILE"
rm "$RESPONSE_FILE"
