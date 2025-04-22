import {
  IJob,
  BilboMdPDBJob,
  BilboMdCRDJob,
  IBilboMDPDBJob,
  IBilboMDCRDJob
} from '@bl1231/bilbomd-mongodb-schema'

type CommonJobData = Pick<
  IJob,
  | 'title'
  | 'uuid'
  | 'status'
  | 'data_file'
  | 'time_submitted'
  | 'user'
  | 'progress'
  | 'cleanup_in_progress'
  | 'steps'
>

type JobSpecificData = {
  pdb_file?: string
  psf_file?: string
  crd_file?: string
  const_inp_file: string
  conformational_sampling: number
  rg: number
  rg_min: number
  rg_max: number
  resubmitted_from?: string
}

type BilboMdJob = IBilboMDPDBJob | IBilboMDCRDJob

export const buildBilboMdJob = (
  mode: 'pdb' | 'crd_psf',
  common: CommonJobData,
  specific: JobSpecificData
): BilboMdJob => {
  if (mode === 'pdb') {
    return new BilboMdPDBJob({
      ...common,
      __t: 'BilboMdPDB',
      const_inp_file: specific.const_inp_file,
      pdb_file: specific.pdb_file!,
      conformational_sampling: specific.conformational_sampling,
      rg: specific.rg,
      rg_min: specific.rg_min,
      rg_max: specific.rg_max,
      steps: { ...common.steps, pdb2crd: {} },
      ...(specific.resubmitted_from
        ? { resubmitted_from: specific.resubmitted_from }
        : {})
    })
  }

  if (mode === 'crd_psf') {
    return new BilboMdCRDJob({
      ...common,
      __t: 'BilboMdCRD',
      const_inp_file: specific.const_inp_file,
      psf_file: specific.psf_file!,
      crd_file: specific.crd_file!,
      conformational_sampling: specific.conformational_sampling,
      rg: specific.rg,
      rg_min: specific.rg_min,
      rg_max: specific.rg_max
    })
  }

  throw new Error(`Unsupported bilbomd_mode: ${mode}`)
}
