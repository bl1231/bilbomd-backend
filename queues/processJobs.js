const Job = require('../model/Job')
const User = require('../model/User')
const { sendJobCompleteEmail } = require('../config/nodemailerConfig')
const {
  generateInputFile,
  generateDynamicsInpFiles,
  runCHARMM,
  countDownTimer
} = require('../controllers/bilbomdController')
const path = require('path')
const { spawn, exec } = require('node:child_process')
const emoji = require('node-emoji')
// emoji.get('rocket')
// emoji.get('white_check_mark')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

//const bilbomd = path.join(__basedir, 'scripts/bilbomd2.pl')

const processBilboMDJob = async (job) => {
  // Make sure job exists in DB
  const foundJob = await Job.findOne({ _id: job.jobid }).exec()
  if (!foundJob) {
    console.log('no job found', job.jobid)
    return 'no job found'
  }
  //console.log(foundJob)

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
  console.log(`Job status set to: ${resultRunning.status}`)

  // BilboMD Magic Here

  const jobDir = path.join(process.env.DATA_VOL, foundJob.uuid)

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
  const minimizationData = {
    out_dir: jobDir,
    template: 'minimize',
    topology_dir: process.env.BILBOMD_TOPPARDIR,
    in_psf: 'input.psf',
    in_crd: 'input.crd',
    out_min_crd: 'minimization_output.crd',
    out_min_pdb: 'minimization_output.pdb'
  }

  await generateInputFile(minimizationData)
  //console.log(emoji.get('white_check_mark'), resultGenMinimize, 'written!')
  //await charmmMinimize(minimizationData)
  await countDownTimer(3)

  // heating
  // creates: heat.inp
  // requires: TOPOLOGY, PSF, and $file_min.crd
  // STREAM const.inp
  // runs: charmm < heat.inp > heat.out
  // outputs: $file_heat.rst
  // outputs: $file_heat.crd
  // outputs: $file_heat.pdb
  const heatData = {
    out_dir: jobDir,
    template: 'heat',
    topology_dir: process.env.BILBOMD_TOPPARDIR,
    in_psf: 'input.psf',
    in_crd: 'minimization_output.crd',
    out_heat_rst: 'heat_output.rst',
    out_heat_crd: 'heat_output.crd',
    out_heat_pdb: 'heat_output.pdb'
  }
  const resultGenHeat = await generateInputFile(heatData)
  await countDownTimer(3)

  // dynamics
  // creates ##  *.dyna##.inp files spaced $Rgstep apart
  // requires: $Toppardir
  // requires: PSF
  // requires: $file_heat.crd
  // requires: $file_heat.rst
  // STREAM const.inp
  //
  // runs all ## jobs: charmm < $file.dyna$y.inp > $file.dyna$y.out
  // output: *.start
  // output: *.rst
  // output: *.dcd
  // output: *.end
  const dynamicsData = {
    out_dir: jobDir,
    template: 'dynamics',
    topology_dir: process.env.BILBOMD_TOPPARDIR,
    in_psf: 'input.psf',
    in_crd: 'heat_output.crd',
    in_rst: 'heat_output.rst',
    rg_min: foundJob.rg_min,
    rg_max: foundJob.rg_max,
    timestep: 0.001
  }

  await generateDynamicsInpFiles(dynamicsData)

  // foxs_from_new_dcd

  // multifoxs

  // extracting_pdbs

  // bilbomd_done

  // cleaning

  // exec(`${bilbomd} ${foundJob.title.replace(/ /g, '_')}`, (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(`exec error: ${error}`)
  //     return
  //   }
  //   console.log(`stdout: ${stdout}`)
  //   console.error(`stderr: ${stderr}`)
  // })

  //await sleep(10000)

  // Set job status to Completed
  foundJob.status = 'Completed'
  foundJob.time_completed = Date()
  const resultCompleted = await foundJob.save()
  console.log(`Job status set to: ${resultCompleted.status}`)

  // send mail to user

  console.log('send email to user', foundUser?.username)
  sendJobCompleteEmail(foundUser?.email, process.env.BILBOMD_URL, foundJob.id)

  return
}

module.exports = { processBilboMDJob }
