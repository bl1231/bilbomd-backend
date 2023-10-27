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

export type BullMQData = {
  type: string
  title: string
  uuid: string
  jobid: string
}

export type BilboMDBullMQ = {
  position: number
  queuePosition: string
  bilbomdStep: BilboMDSteps
  bilbomdLastStep: string
  bullmq: BullMQJob
}

export type BilboMDJob = {
  mongo: MongoDBJob
  bullmq?: BilboMDBullMQ
  username?: string
}
