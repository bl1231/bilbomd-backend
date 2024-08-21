
# BilboMD Job Results

This directory contains the results for your pipeline_007_mer BilboMD job.

- Job Title:  pipeline_007_mer
- Job ID:  65d7d8433323ba0029635c7c
- UUID:  ae9dbaa9-ce01-48c3-ba09-90bfd7a45e8a
- Submitted:  Thu Feb 22 2024 15:26:59 GMT-0800 (Pacific Standard Time)
- Completed:  Thu Feb 22 2024 17:48:26 GMT-0800 (Pacific Standard Time)

## Contents

- Original CRD file:  step1_pdbreader.crd
- Original PSF file:  step1_pdbreader.psf
- Original experimental SAXS data file:  tdp1_dep_merged_jdm.dat
- Original const.inp file:  const.inp

The Ensemble files will be present in multiple copies. There is one file for each ensemble size.

- Number of ensembles for this BilboMD run: 7

- Ensemble PDB file(s):  ensemble_size_N_model.pdb
- Ensemble TXT file(s):  ensemble_size_N.txt
- Ensemble DAT file(s):  multi_state_model_N_1_1.dat

## The ensemble_size_N.txt files

Here is an example from a hypothetical ensemble_size_3.txt file:

1 |  2.89 | x1 2.89 (0.99, -0.50)
   70   | 0.418 (0.414, 0.011) | ../foxs/rg25_run3/dcd2pdb_rg25_run3_271500.pdb.dat (0.138)
   87   | 0.508 (0.422, 0.101) | ../foxs/rg41_run1/dcd2pdb_rg41_run1_35500.pdb.dat (0.273)
  184   | 0.074 (0.125, 0.024) | ../foxs/rg45_run1/dcd2pdb_rg45_run1_23000.pdb.dat (0.025)

In this example we show only the "best" 3-state ensemble. Each ensemble_size_N.txt file will
actually contain many possible N-state ensembles.

The first line is a summary of scores and fit parameters for a particular multi-state model:
    - The first column is a number/rank of the multi-state model (sorted by score)
    - The second column is a Chi^2 value for the fit to SAXS profile (2.89)
    - The third column repeats the Chi^2 value and also displays a pair of c1 (0.99) and c2 (-0.50)
      values (in brackets) from the MultiFoXS optimized fit to data.

After the model summary line the file contains information about the states (one line per state).
In this example the best scoring 3-state model consists of conformation numbers 70, 87, and 184
with weights of 0.418, 0.508, and 0.074 respectively. The numbers in brackets after the
conformation weight are an average and a standard	deviation of the weight calculated for this
conformation across all good scoring multi-state models of this size. The number in brackets
after the filename is the fraction of good scoring multi-state models that contain this conformation.

## The ensemble_size_N_model.pdb files

In the case of N>2 These will be multi-model PDB files. For N=1 it will just be the best single conformer
to fit your SAXS data.

ensemble_size_1_model.pdb  - will contain the coordinates for the best 1-state model
ensemble_size_2_model.pdb  - will contain the coordinates for the best 2-state model
ensemble_size_3_model.pdb  - will contain the coordinates for the best 3-state model
etc.

## The multi_state_model_N_1_1.dat files

These are the theoretical SAXS curves from MultiFoXS calculated for each of the ensemble_size_N_model.pdb models.

If you use BilboMD in your research, please cite:

Pelikan M, Hura GL, Hammel M. Structure and flexibility within proteins as identified through small angle X-ray scattering. Gen Physiol Biophys. 2009 Jun;28(2):174-89. doi: 10.4149/gpb_2009_02_174. PMID: ,19592714; PMCID: PMC3773563.

Thank you for using BilboMD
