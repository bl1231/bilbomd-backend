import path from 'path'
import fs from 'fs-extra'
import { Job, IBilboMDCRDJob, IBilboMDPDBJob } from '@bl1231/bilbomd-mongodb-schema'

const uploadFolder: string = path.join(process.env.DATA_VOL ?? '')

interface ResubmissionFilesResult {
  constInpFile: string
  dataFile: string
  extraFiles: Record<string, string> // e.g., psf_file, crd_file, or pdb_file
}

export const resolveResubmissionFiles = async (
  originalJobId: string,
  UUID: string
): Promise<ResubmissionFilesResult> => {
  const originalJob = (await Job.findById(originalJobId)) as
    | IBilboMDPDBJob
    | IBilboMDCRDJob

  if (!originalJob) {
    throw new Error(`Original job with ID ${originalJobId} not found`)
  }

  const originalDir = path.join(uploadFolder, originalJob.uuid)
  const newDir = path.join(uploadFolder, UUID)

  const constInpFile = originalJob.const_inp_file
  const dataFile = originalJob.data_file

  await fs.copy(path.join(originalDir, constInpFile), path.join(newDir, constInpFile))
  await fs.copy(path.join(originalDir, dataFile), path.join(newDir, dataFile))

  const extraFiles: Record<string, string> = {}

  if ('psf_file' in originalJob && 'crd_file' in originalJob) {
    extraFiles.psf_file = originalJob.psf_file ?? ''
    extraFiles.crd_file = originalJob.crd_file ?? ''

    await fs.copy(
      path.join(originalDir, originalJob.psf_file ?? ''),
      path.join(newDir, originalJob.psf_file ?? '')
    )
    await fs.copy(
      path.join(originalDir, originalJob.crd_file ?? ''),
      path.join(newDir, originalJob.crd_file ?? '')
    )
  } else if ('pdb_file' in originalJob) {
    extraFiles.pdb_file = originalJob.pdb_file ?? ''

    await fs.copy(
      path.join(originalDir, originalJob.pdb_file),
      path.join(newDir, originalJob.pdb_file)
    )
  }

  return { constInpFile, dataFile, extraFiles }
}
