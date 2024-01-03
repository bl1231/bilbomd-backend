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
}

export type BilboMDScoperSteps = {
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

export type BilboMDBullMQ = {
  position: number | string
  queuePosition: string
  bilbomdStep: BilboMDSteps | BilboMDScoperSteps
  bilbomdLastStep: string
  bullmq: BullMQJob
}

export type BilboMDJob = {
  mongo: MongoDBJob
  bullmq?: BilboMDBullMQ
  username?: string
}

export interface IJob {
  _id: string
  title: string
  uuid: string
  data_file: string
  status: string
  time_submitted: string // Assuming this is a date in string format
  user: string // Assuming this is a user ID in string format
  __t: string
  pdb_file: string
  createdAt: string // Assuming date in string format
  updatedAt: string // Assuming date in string format
  __v: number
  time_started: string // Assuming date in string format
  time_completed: string // Assuming date in string format
  id: string
}
