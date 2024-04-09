import { Job as BullMQJob } from 'bullmq'
import { Job as MongoDBJob } from 'model/Job'

export type BilboMDSteps = {
  pae?: string
  autorg?: string
  minimize: string
  heat: string
  md: string
  foxs: string
  multifoxs: string
  results: string
  email: string
  numEnsembles: number
}

export type BilboMDScoperSteps = {
  reduce: string
  rnaview: string
  kgs: string
  kgsConformations: number
  kgsFiles: number
  foxs: string
  foxsProgress: number
  foxsTopFile: string
  foxsTopScore: number
  createdFeatures: boolean
  IonNet: string
  predictionThreshold: number
  multifoxs: string
  multifoxsEnsembleSize: number
  multifoxsScore: number
  scoperPdb: string
  scoper: string
  results: string
  email: string
}

export type BullMQData = {
  type: string
  title: string
  uuid: string
  jobid: string
}

export type BullMQPdb2Crd = {
  type: string
  title: string
  uuid: string
}

export type BilboMDBullMQ = {
  position: number | string
  queuePosition: string
  bilbomdStep: BilboMDSteps | BilboMDScoperSteps
  bilbomdLastStep: string
  bullmq: BullMQJob
}

export type BilboMDJob = {
  id: string
  username?: string
  mongo: MongoDBJob
  bullmq?: BilboMDBullMQ
  scoper?: BilboMDScoperSteps
  classic?: BilboMDSteps
  auto?: BilboMDSteps
}

export interface IJob {
  id: string
  _id: string
  __t: string
  conformational_sampling: number
  const_inp_file: string
  crd_file: string
  createdAt: string
  data_file: string
  psf_file: string
  pdb_file: string
  rg_max: number
  rg_min: number
  status: string
  time_completed: string
  time_started: string
  time_submitted: string
  title: string
  updatedAt: string
  user: string
  uuid: string
}
