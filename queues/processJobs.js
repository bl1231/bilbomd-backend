const Job = require('../model/Job')
const User = require('../model/User')
const { sendJobCompleteEmail } = require('../config/nodemailerConfig')
const {
  generateInputFile,
  generateDynamicsInpFiles,
  runCHARMM,
  runMD,
  countDownTimer
} = require('../controllers/bilbomdController')
const path = require('path')
const { spawn, exec } = require('node:child_process')
const emoji = require('node-emoji')
// emoji.get('rocket')
// emoji.get('white_check_mark')
const check = emoji.get('white_check_mark')
const rocket = emoji.get('rocket')
const skull = emoji.get('skull_and_crossbones')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const topoFiles = process.env.CHARM_TOPOLOGY

const bilbomdMinimize = async () => {
  //
}

const processBilboMDJob = async (job) => {
  // console.log('job:', job)
  // Make sure job exists in DB
  const foundJob = await Job.findOne({ _id: job.jobid }).exec()
  if (!foundJob) {
    console.log(skull, 'no job found', job.jobid)
    return 'no job found'
  }
  //console.log(foundJob)

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

  // BilboMD Magic Here

  const jobDir = path.join(process.env.DATA_VOL, foundJob.uuid)

  // minimization
  const minimizationData = {
    out_dir: jobDir,
    template: 'minimize',
    inp_basename: 'minimize',
    topology_dir: topoFiles,
    in_psf: foundJob.psf_file,
    in_crd: foundJob.crd_file,
    out_min_crd: 'minimization_output.crd',
    out_min_pdb: 'minimization_output.pdb'
  }

  try {
    const inpFile = await generateInputFile(minimizationData)
    console.log(check, inpFile, 'written!')
  } catch (err) {
    console.log(skull, inpFile, 'file generation failed!')
    console.log(err)
  }

  try {
    console.log(rocket, 'Start CHARMM minimize')
    const minimize = await runCHARMM(minimizationData)
    console.log(check, 'CHARMM minimize done')
  } catch (err) {
    console.log(skull, 'CHARMM minimize failed!')
    console.log(err)
  }

  // heating
  const heatData = {
    out_dir: jobDir,
    template: 'heat',
    inp_basename: 'heat',
    topology_dir: topoFiles,
    in_psf: foundJob.psf_file,
    in_crd: 'minimization_output.crd',
    constinp: foundJob.const_inp_file,
    out_heat_rst: 'heat_output.rst',
    out_heat_crd: 'heat_output.crd',
    out_heat_pdb: 'heat_output.pdb'
  }
  try {
    const inpFile = await generateInputFile(heatData)
    //await countDownTimer('generate inp file', 5)
    console.log(check, inpFile, 'created')
  } catch (err) {
    console.log(skull, inpFile, 'file generation failed!')
    console.log(err)
  }

  try {
    console.log(rocket, 'Start heating step')
    const minimize = await runCHARMM(heatData)
    console.log(check, 'CHARMM heating done')
  } catch (err) {
    console.log(skull, 'CHARMM heating failed!')
    console.log(err)
  }

  // dynamics
  const dynamicsData = {
    out_dir: jobDir,
    template: 'dynamics',
    inp_basename: '',
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
    await generateDynamicsInpFiles(dynamicsData)
    console.log(check, 'All dynamics.inp files created.')
  } catch (err) {
    console.log(skull, 'dynamics.inp file generation failed!')
    console.log(err)
  }

  try {
    console.log(rocket, 'Start Molecular Dynamics')
    const minimize = await runMD(dynamicsData)
    console.log(check, 'Molecular Dynamics')
  } catch (err) {
    console.log(skull, 'Molecular Dynamics failed!')
    console.log(err)
  }

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
  console.log(check, `Job status set to: ${resultCompleted.status}`)

  // send mail to user

  console.log('send email to user', foundUser?.username)
  sendJobCompleteEmail(foundUser?.email, process.env.BILBOMD_URL, foundJob.id)

  return
}

module.exports = { processBilboMDJob }
