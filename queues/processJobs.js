const Job = require('../model/Job')
const User = require('../model/User')
const { sendJobCompleteEmail } = require('../config/nodemailerConfig')
const path = require('path')
const { spawn, exec } = require('node:child_process')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const bilbomd = path.join(__basedir, 'scripts/bilbomd2.pl')

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

  // Run Perl script

  const jobDir = path.join(process.env.DATA_VOL, foundJob.uuid)

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

  // setup
  // validates variables
  // checks for runtime dependences

  // input_for_dynamics_and_foxs
  // clean/reformat experimental *.dat file
  // checks Rg_min and Rg_max
  // sets: $Rgstep = (Rg_mx - Rg_min) / 5
  // sets: $step = 0.001
  // sets a bunch of rando variables

  // minimization
  // creates: minimize.inp
  // requires: TOPOLOGY, PSF, and CRD
  // runs: charmm < minimize.inp > minimize.out
  // outputs: $file_min.crd
  // outputs: $file_min.psf

  // heating
  // creates: heat.inp
  // requires: TOPOLOGY, PSF, and $file_min.crd
  // STREAM const.inp
  // runs: charmm < heat.inp > heat.out
  // outputs: $file_heat.rst
  // outputs: $file_heat.crd
  // outputs: $file_heat.psf

  // dynamics
  // creates ##  *.dyna##.inp files spaced $Rgstep apart
  // requires: TOPOLOGY and PSF
  // requires: $file_heat.crd
  // requires: $file_heat.rst
  // STREAM const.inp
  //
  // runs all ## jobs: charmm < $file.dyna$y.inp > $file.dyna$y.out
  // output: *.start
  // output: *.rst
  // output: *.dcd
  // output: *.end

  // foxs_from_new_dcd

  // multifoxs

  // extracting_pdbs

  // bilbomd_done

  // cleaning

  exec(`${bilbomd} ${foundJob.title.replace(/ /g, '_')}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`)
      return
    }
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  })

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
