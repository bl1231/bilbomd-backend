const Handlebars = require('handlebars')
const { readFile, writeFile } = require('node:fs/promises')
const { spawn } = require('node:child_process')
const { access, watch } = require('node:fs/promises')
//const { mkdir, openSync, closeSync } = require('node:fs')
const fs = require('fs-extra')
//const path = require('node:path')
// const ac = new AbortController()
// const { signal } = ac
const chokidar = require('chokidar')
const util = require('node:util')
const execFile = util.promisify(require('node:child_process').execFile)
const myPath = require('path')
const templates = myPath.resolve(__dirname, '../templates/bilbomd')
const emoji = require('node-emoji')
const e = require('express')
const check = emoji.get('white_check_mark')
const rocket = emoji.get('rocket')
const skull = emoji.get('skull_and_crossbones')
const pepper = emoji.get('hot_pepper')

const writeToFile = async (templateString, params) => {
  outFile = myPath.join(params.out_dir, params.charmm_inp_file)
  var template = Handlebars.compile(templateString)
  var outputString = template(params)
  await writeFile(outFile, outputString)
}

const extractPdbFromDcd = async (params) => {
  try {
    await spawnCHARMM(params)
    console.log(check, 'extractPdbFromDcd got params:', params)
  } catch (err) {
    console.log(skull, 'extractPdbFromDcd failed!')
    console.log(err)
  }
}

const generateInputFile = async (params) => {
  try {
    const templateFile = myPath.join(templates, `${params.template}.handlebars`)
    const templateString = await readFile(templateFile, 'utf8')
    await writeToFile(templateString, params)
    console.log(check, 'wrote CHARMM input file: ', params.charmm_inp_file)
  } catch (err) {
    console.log(skull, 'Something went badly! Unable to generate inp file')
    console.error(err)
  }
}

const generateDCD2PDBInpFile = async (params, rg, run) => {
  params.template = 'dcd2pdb'
  params.in_pdb = 'heat_output.pdb'
  params.in_dcd = `dynamics_rg${rg}_run${run}.dcd`
  params.foxs_rg = 'foxs_rg.out'
  params.charmm_inp_file = `${params.template}_rg${rg}_run${run}.inp`
  try {
    await generateInputFile(params)
  } catch (error) {
    console.error(error)
  }
}

const fileExists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const watchForEndFile = async (dir, endFileName) => {
  console.log('watchForEndFile: dir:', dir)
  console.log('watchForEndFile: file:', endFileName)
  try {
    const watcher = watch(dir)
    for await (const event of watcher) {
      // console.log('e', event)
      if (event.filename == endFileName) {
        console.log('event:', event)
        return event.filename
      }
    }
  } catch (error) {
    console.error(error)
  }
}

const runMolecularDynamics = async (params) => {
  console.log('runMolecularDynamics ------------- START')
  makeAllInpFiles = []
  runAllCharmm = []
  const step = (params.rg_max - params.rg_min) / 5
  for (let rg = params.rg_min; rg <= params.rg_max; rg += step) {
    params.charmm_inp_file = `${params.template}_rg${rg}.inp`
    params.charmm_out_file = `${params.template}_rg${rg}.out`
    params.inp_basename = `${params.template}_rg${rg}`
    // makeAllInpFiles.push(generateInputFile(params))
    await generateInputFile(params)
    runAllCharmm.push(spawnCHARMM(params))
  }
  // try {
  //   await Promise.all(makeAllInpFiles).then(() => {
  //     console.log(check, 'All CHARMM MD *inp files created.')
  //   })
  // } catch (error) {
  //   console.error('makeAllInpFiles:', error)
  // }

  await Promise.all(runAllCharmm).then(() => {
    console.log(check, 'All CHARMM MD runs complete.')
  })

  console.log('runMolecularDynamics ------------- END')
}

const makeFile = async (f) => {
  try {
    await fs.ensureFile(f)
    console.log(check, 'created: ', f)
  } catch (err) {
    console.error(err)
  }
}

const runFoXS = async (params) => {
  console.log(pepper, 'runFoXS ------------- START')
  const foxsDir = myPath.join(params.out_dir, 'fit')
  console.log('foxsDir', foxsDir)
  fs.mkdir(foxsDir, (error) => {
    if (error) {
      return console.error(error)
    }
    console.log(check, `${foxsDir} directory created`)
  })
  params.foxs_rg = 'foxs_rg.out'
  const foxsRgFile = myPath.join(params.out_dir, params.foxs_rg)
  makeFile(foxsRgFile)

  makeAllDcd2PdbInpFiles = []
  runAllCharmm = []
  const step = (params.rg_max - params.rg_min) / 5
  for (let rg = params.rg_min; rg <= params.rg_max; rg += step) {
    for (let run = 1; run <= params.conf_sample; run += 1) {
      params.template = 'dcd2pdb'
      params.charmm_inp_file = `${params.template}_rg${rg}_run${run}.inp`
      params.charmm_out_file = `${params.template}_rg${rg}_run${run}.out`
      params.inp_basename = `${params.template}_rg${rg}_run${run}`

      //const endFileName = `${params.template}_rg${rg}_run${run}.end`
      //params.end_file = endFileName
      //const endFile = myPath.join(params.out_dir, endFileName)
      // This doesn't work for some reason!
      // using the last "version" of params...WTF?
      //makeAllDcd2PdbInpFiles.push(generateDCD2PDBInpFile(params, rg, run))
      // This does work, and all iterations of teh inp file get created
      await generateDCD2PDBInpFile(params, rg, run)
      runAllCharmm.push(spawnCHARMM(params))

      // await for for CHARMM
      // await FoXS
      // await countDownTimer('ack', 1)
      //console.log(check, 'got:', ef)
    }
  }
  await Promise.all(runAllCharmm).then(() => {
    console.log(check, 'All CHARMM DCD2PDB runs complete.')
  })
  // then run FoXS

  console.log('runFoXS ------------- END')
}

const asyncCHARMM = async (params) => {
  console.log('asyncCHARMM -->', params.charmm_inp_file)
  charmm = process.env.CHARMM
  input = params.charmm_inp_file
  output = params.charmm_out_file
  await execFile(charmm, ['-o', output, '-i', input], {
    cwd: params.out_dir
  })
}

const spawnCHARMM = (params) =>
  new Promise((resolve, reject) => {
    input = params.charmm_inp_file
    output = params.charmm_out_file
    console.log(rocket, 'Spawn CHARMMjob:', input)
    const charmm = spawn(process.env.CHARMM, ['-o', output, '-i', input], {
      cwd: params.out_dir
    })
    charmm.stdout.on('data', (data) => {
      console.log('charmm stdout', data)
    })
    charmm.stderr.on('data', (data) => {
      console.error('charmm stderr', data)
      reject()
    })
    charmm.on('close', (code) => {
      //console.log('finished:', input, 'exit code:', code)
      resolve()
    })
  })

const runMinimize = async (params) => {
  params.charmm_inp_file = `${params.template}.inp`
  params.charmm_out_file = `${params.template}.out`
  try {
    await generateInputFile(params)
    await spawnCHARMM(params)
    console.log(check, 'minimized complete')
  } catch (error) {
    console.error('runMinimize error:', error)
  }
}

const runHeat = async (params) => {
  params.charmm_inp_file = `${params.template}.inp`
  params.charmm_out_file = `${params.template}.out`
  try {
    await generateInputFile(params)
    await spawnCHARMM(params)
    console.log(check, 'heat complete')
  } catch (error) {
    console.error('runHeat error:', error)
  }
}

const countDownTimer = async (message, seconds) => {
  console.log('Start', message, 'countDownTimer for', seconds, 'sec')
  const go = {
    timer: null,
    message: '',
    time: 0,
    countdown: (duration = 10) => {
      clearInterval(go.timer)
      return new Promise(function (resolve, reject) {
        go.timer = setInterval(function () {
          go.time--
          console.log(go.message + ': ' + go.time)
          if (!go.time) {
            clearInterval(go.timer)
            resolve()
          }
        }, 1000)
      })
    },
    do: async (msg, time = 10) => {
      go.time = time
      go.message = msg
      await go.countdown(go.time)
    }
  }
  await go.do(message, seconds)
  console.log(`Finished ${message}`)
}

module.exports = {
  runMinimize,
  runHeat,
  runMolecularDynamics,
  runFoXS,
  countDownTimer
}
