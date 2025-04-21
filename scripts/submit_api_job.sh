#!/bin/bash
#
# remember to export the BILBOMD_API_TOKEN variable before running this script
#
# export BILBOMD_API_TOKEN="your_api_token_here"
#
API_URL="http://localhost:3501/api/v1/external/jobs"


PDB_FILE=./test/data/pro_dna_complex.pdb
DAT_FILE="./test/data/pro_dna_saxs.dat"
INP_FILE="./test/data/my_const.inp"

curl -X POST "$API_URL" \
  -H "Authorization: Bearer $BILBOMD_API_TOKEN" \
  -H "Accept: application/json" \
  -F "bilbomd_mode=pdb" \
  -F "title=API Test Job" \
  -F "pdb_file=@${PDB_FILE}" \
  -F "num_conf=2" \
  -F "rg=30" \
  -F "rg_min=22" \
  -F "rg_max=41" \
  -F "dat_file=@${DAT_FILE}" \
  -F "inp_file=@${INP_FILE}" | jq . || echo "Warning: 'jq' not installed. Raw response follows:"
