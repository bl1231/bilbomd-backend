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


PDB_FILE="$SCRIPT_DIR/../test/data/auto1/auto1.pdb"
DAT_FILE="$SCRIPT_DIR/../test/data/auto1/saxs-data.dat"
PAE_FILE="$SCRIPT_DIR/../test/data/auto1/auto1-pae.json"

RESPONSE_FILE=$(mktemp)
HTTP_STATUS=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  -X POST "$API_URL"/ \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=auto" \
  -F "title=API Test Job Auto1" \
  -F "pdb_file=@${PDB_FILE}" \
  -F "dat_file=@${DAT_FILE}" \
  -F "pae_file=@${PAE_FILE}" )

echo "HTTP Status: $HTTP_STATUS"
jq . < "$RESPONSE_FILE" || cat "$RESPONSE_FILE"
rm "$RESPONSE_FILE"
