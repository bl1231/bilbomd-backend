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


PDB_FILE="$SCRIPT_DIR/../test/data/auto1/af-q9z2a5-f1-model_v4.pdb"
DAT_FILE="$SCRIPT_DIR/../test/data/auto1/mmate1-1_13.dat"
PAE_FILE="$SCRIPT_DIR/../test/data/auto1/af-q9z2a5.json"

curl -X POST "$API_URL" \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=auto" \
  -F "title=API Test Job Auto1" \
  -F "pdb_file=@${PDB_FILE}" \
  -F "dat_file=@${DAT_FILE}" \
  -F "pae_file=@${PAE_FILE}" | jq . || echo "Warning: 'jq' not installed. Raw response follows:"
