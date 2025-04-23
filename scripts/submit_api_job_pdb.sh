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


PDB_FILE="$SCRIPT_DIR/../test/data/pdb/pro_dna_complex.pdb"
DAT_FILE="$SCRIPT_DIR/../test/data/pdb/pro_dna_saxs.dat"
INP_FILE="$SCRIPT_DIR/../test/data/pdb/my_const.inp"

curl -X POST "$API_URL" \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=pdb" \
  -F "title=API Test Job PDB" \
  -F "pdb_file=@${PDB_FILE}" \
  -F "dat_file=@${DAT_FILE}" \
  -F "inp_file=@${INP_FILE}" | jq . || echo "Warning: 'jq' not installed. Raw response follows:"
