#!/bin/bash

API_URL="http://localhost:3501/api/v1/external/jobs"
API_TOKEN="ce57039f1fa0afd38dd765fc945d6e7c16eaa2f60309c468cd2342ec8cc81b6d"

PDB_FILE=./test/data/pro_dna_complex.pdb
DAT_FILE="./test/data/pro_dna_saxs.dat"
INP_FILE="./test/data/my_const.inp"

curl -X POST "$API_URL" \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "bilbomd_mode=pdb" \
  -F "title=API Test Job" \
  -F "pdb_file=@${PDB_FILE}" \
  -F "num_conf=2" \
  -F "rg=30" \
  -F "rg_min=22" \
  -F "rg_max=41" \
  -F "dat_file=@${DAT_FILE}" \
  -F "inp_file=@${INP_FILE}"
