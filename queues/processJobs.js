const Job = require('../model/Job')
const User = require('../model/User')
const { sendJobCompleteEmail } = require('../config/nodemailerConfig')
const path = require('path')
const { spawn } = require('node:child_process')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const processBilboMDJob = async (job) => {
  // Make sure job exists in DB
  const foundJob = await Job.findOne({ _id: job.jobid }).exec()
  if (!foundJob) {
    console.log('no job found', job.jobid)
    return 'no job found'
  }

  // Make sure the user exists
  const foundUser = await User.findById(foundJob.user).lean().exec()
  if (!foundUser) {
    console.log('no user found for job:', job.jobid)
    return 'no user found'
  }

  // Set job status to Running
  foundJob.status = 'Running'
  foundJob.time_started = Date()
  const resultRunning = await foundJob.save()
  console.log('job status set to - Running')
  //console.log(resultRunning)

  // Run Perl script
  // sleep for a few seconds so I can see the status update in ui
  const jobDir = path.join(process.env.DATA_VOL, foundJob.uuid)

  // &setup;
  // &clean_segment;
  // &input_for_dynamics_and_foxs;
  // &minimization;
  // &heating;
  // &dynamics;
  // &foxs_from_new_dcd;
  // &multifoxs;
  // &MES_conformers_analysis_dcd2gapdb;
  // &bilbomd_done;
  // &cleaning;

  const params = []
  params.push(foundJob.title.replace(/ /g, '_'))
  params.push(jobDir)
  params.push(foundUser.email)
  params.push(foundJob.data_file)
  params.push(0.5) //maxQ
  params.push(foundJob.conformational_sampling)
  params.push(foundJob.rg_min)
  params.push(foundJob.rg_max)
  //params.push(foundJob.rg_max)

  console.log(params)

  await sleep(10000)

  // Set job status to Completed
  foundJob.status = 'Completed'
  foundJob.time_completed = Date()
  const resultCompleted = await foundJob.save()
  console.log('job status set to - Completed')
  //console.log(resultCompleted)

  // send mail to user

  console.log('send email to user', foundUser?.username)
  sendJobCompleteEmail(foundUser?.email, process.env.BILBOMD_URL, foundJob.id)

  return
}

module.exports = { processBilboMDJob }
