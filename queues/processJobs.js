const Job = require('../model/Job')
const { Job: BullMQJob } = require('bullmq')
const User = require('../model/User')
const { sendJobCompleteEmail } = require('../config/nodemailerConfig')
const {
  runMinimize,
  runHeat,
  runMolecularDynamics,
  runFoXS,
  countDownTimer
} = require('../controllers/bilbomdController')
const path = require('path')

const emoji = require('node-emoji')
const check = emoji.get('white_check_mark')
const rocket = emoji.get('rocket')
const skull = emoji.get('skull_and_crossbones')
const id = emoji.get('id')
const pepper = emoji.get('hot_pepper')
const topoFiles = process.env.CHARM_TOPOLOGY
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const processBilboMDJob = async (job) => {
  console.log(pepper, ' Start job', id, job.data.uuid)
  console.log(pepper, ' BullMQ ID:', job.id)
  await job.log(`Start job ${job.data.uuid}`)

  // Make sure job exists in MongoDB
  const foundJob = await Job.findOne({ _id: job.data.jobid }).exec()
  if (!foundJob) {
    console.log(skull, 'no job found for:', job.data.jobid)
    job.log(`no job found for ${job.data.jobid}`)
    return 'no job found'
  }

  // Make sure the user exists
  const foundUser = await User.findById(foundJob.user).lean().exec()
  if (!foundUser) {
    console.log(skull, 'no user found for job:', job.data.jobid)
    job.log(skull, 'no user found for job:', job.data.jobid)
    return 'no user found'
  }

  // Set job status to Running
  foundJob.status = 'Running'
  foundJob.time_started = Date()
  const resultRunning = await foundJob.save()
  console.log(check, `Job status set to: ${resultRunning.status}`)
  job.log(`MongoDB job status set to ${resultRunning.status}`)

  const jobDir = path.join(process.env.DATA_VOL, foundJob.uuid)

  // minimization
  // const minimizationData = {
  //   out_dir: jobDir,
  //   template: 'minimize',
  //   topology_dir: topoFiles,
  //   in_psf: foundJob.psf_file,
  //   in_crd: foundJob.crd_file,
  //   out_min_crd: 'minimization_output.crd',
  //   out_min_pdb: 'minimization_output.pdb'
  // }
  //const job.data = {foundJob.psf_file, ...job.data}
  //await job.update(job.data)
  await job.log('start minimization')
  await runMinimize(job)
  await job.updateProgress(25)

  // heating
  // const heatData = {
  //   out_dir: jobDir,
  //   template: 'heat',
  //   topology_dir: topoFiles,
  //   in_psf: foundJob.psf_file,
  //   in_crd: 'minimization_output.crd',
  //   constinp: foundJob.const_inp_file,
  //   out_heat_rst: 'heat_output.rst',
  //   out_heat_crd: 'heat_output.crd',
  //   out_heat_pdb: 'heat_output.pdb'
  // }
  // await job.log('start heating')
  // await runHeat(heatData)
  // await job.updateProgress(50)

  // dynamics
  // const dynamicsData = {
  //   out_dir: jobDir,
  //   template: 'dynamics',
  //   topology_dir: topoFiles,
  //   in_psf: foundJob.psf_file,
  //   in_crd: 'heat_output.crd',
  //   in_rst: 'heat_output.rst',
  //   constinp: foundJob.const_inp_file,
  //   rg_min: foundJob.rg_min,
  //   rg_max: foundJob.rg_max,
  //   conf_sample: foundJob.conformational_sampling,
  //   timestep: 0.001
  // }

  // try {
  //   await job.log('start molecular dynamics')
  //   await runMolecularDynamics(dynamicsData)
  //   await job.updateProgress(75)
  //   await job.log('start FoXS')
  //   await runFoXS(dynamicsData)
  //   await job.updateProgress(99)
  // } catch (error) {
  //   console.error(error)
  // }

  // Set job status to Completed
  foundJob.status = 'Completed'
  foundJob.time_completed = Date()
  const resultCompleted = await foundJob.save()
  console.log(check, `Job status set to: ${resultCompleted.status}`)
  job.log(`MongoDB job status set to ${resultCompleted.status}`)
  // send mail to user

  console.log('send email to user', foundUser?.username)
  sendJobCompleteEmail(foundUser?.email, process.env.BILBOMD_URL, foundJob.id)
  await job.log(`email notification sent to ${foundUser?.email}`)
  await job.updateProgress(100)
  return 'ok'
}

module.exports = { processBilboMDJob }
