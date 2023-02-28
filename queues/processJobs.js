const Job = require('../model/Job')
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
const { spawn, exec } = require('node:child_process')
const emoji = require('node-emoji')
const check = emoji.get('white_check_mark')
const rocket = emoji.get('rocket')
const skull = emoji.get('skull_and_crossbones')
const id = emoji.get('id')
const pepper = emoji.get('hot_pepper')
const topoFiles = process.env.CHARM_TOPOLOGY
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const processBilboMDJob = async (job) => {
  console.log(pepper, ' Start job', id, job.uuid)
  // Make sure job exists in DB
  const foundJob = await Job.findOne({ _id: job.jobid }).exec()
  if (!foundJob) {
    console.log(skull, 'no job found for:', job.jobid)
    return 'no job found'
  }

  // Make sure the user exists
  const foundUser = await User.findById(foundJob.user).lean().exec()
  if (!foundUser) {
    console.log(skull, 'no user found for job:', job.jobid)
    return 'no user found'
  }

  // Set job status to Running
  foundJob.status = 'Running'
  foundJob.time_started = Date()
  const resultRunning = await foundJob.save()
  console.log(check, `Job status set to: ${resultRunning.status}`)

  //await countDownTimer('one', 5)

  // BilboMD Magic Here

  const jobDir = path.join(process.env.DATA_VOL, foundJob.uuid)

  // minimization
  const minimizationData = {
    out_dir: jobDir,
    template: 'minimize',
    topology_dir: topoFiles,
    in_psf: foundJob.psf_file,
    in_crd: foundJob.crd_file,
    out_min_crd: 'minimization_output.crd',
    out_min_pdb: 'minimization_output.pdb'
  }

  await runMinimize(minimizationData)

  // heating
  const heatData = {
    out_dir: jobDir,
    template: 'heat',
    topology_dir: topoFiles,
    in_psf: foundJob.psf_file,
    in_crd: 'minimization_output.crd',
    constinp: foundJob.const_inp_file,
    out_heat_rst: 'heat_output.rst',
    out_heat_crd: 'heat_output.crd',
    out_heat_pdb: 'heat_output.pdb'
  }

  await runHeat(heatData)
  //await countDownTimer('two', 5)
  // dynamics
  const dynamicsData = {
    out_dir: jobDir,
    template: 'dynamics',
    topology_dir: topoFiles,
    in_psf: foundJob.psf_file,
    in_crd: 'heat_output.crd',
    in_rst: 'heat_output.rst',
    constinp: foundJob.const_inp_file,
    rg_min: foundJob.rg_min,
    rg_max: foundJob.rg_max,
    conf_sample: foundJob.conformational_sampling,
    timestep: 0.001
  }

  try {
    await runMolecularDynamics(dynamicsData)
    await runFoXS(dynamicsData)
  } catch (error) {
    console.error(error)
  }

  // try {
  //   await generateDynamicsInpFiles(dynamicsData)
  //   console.log(check, 'All dynamics.inp files created.')
  // } catch (err) {
  //   console.log(skull, 'dynamics.inp file generation failed!')
  //   console.log(err)
  // }

  // Run MD then extract PDBs from DCD Trajectory files
  // try {
  //   console.log(rocket, 'Start Molecular Dynamics')
  //   await runMD(dynamicsData)
  //   console.log(check, 'Molecular Dynamics Done!')
  // } catch (err) {
  //   console.log(skull, 'Molecular Dynamics failed!')
  //   console.log(err)
  // }

  // foxs_from_new_dcd
  // need this guy to wait

  // multifoxs

  // extracting_pdbs

  // Set job status to Completed
  foundJob.status = 'Completed'
  foundJob.time_completed = Date()
  const resultCompleted = await foundJob.save()
  console.log(check, `Job status set to: ${resultCompleted.status}`)

  // send mail to user

  console.log('send email to user', foundUser?.username)
  sendJobCompleteEmail(foundUser?.email, process.env.BILBOMD_URL, foundJob.id)

  return
}

module.exports = { processBilboMDJob }
