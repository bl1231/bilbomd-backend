const Job = require('../model/Job')
const User = require('../model/User')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const processBilboMDJobs = async (job) => {
  // Make sure job exists in DB
  const foundJob = await Job.findOne({ _id: job.jobid }).exec()
  if (!foundJob) {
    console.log('no job found', job.jobid)
    return 'no job found'
  }

  // Set job status to Running
  foundJob.status = 'Running'
  const resultRunning = await foundJob.save()
  console.log('job status set to - Running')
  console.log(resultRunning)

  // Run Perl script
  await sleep(10000)

  // Set job status to Completed
  foundJob.status = 'Completed'
  const resultCompleted = await foundJob.save()
  console.log('job status set to - Completed')
  console.log(resultCompleted)

  // send mail to user
  console.log('send email to user')

  return
}

module.exports = { processBilboMDJobs }
