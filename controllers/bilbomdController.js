const Handlebars = require('handlebars')
const { readFile, writeFile } = require('node:fs/promises')
const { spawn, spawnSync } = require('node:child_process')
const path = require('path')
const templatePath = path.resolve(__dirname, '../templates/bilbomd')
const emoji = require('node-emoji')
// emoji.get('rocket')
// emoji.get('white_check_mark')

const writeToFile = async (templateString, params) => {
  outFile = path.join(params.out_dir, `${params.inp_basename}.inp`)
  console.log('writeToFile', outFile)
  var template = Handlebars.compile(templateString)
  var outputString = template(params)
  await writeFile(outFile, outputString, (err) => {
    if (err) console.error(err)
  })
}

const generateInputFile = async (params) => {
  console.log(`generate: ${params.inp_basename}.inp`)
  try {
    const templateFile = path.join(templatePath, `${params.template}.handlebars`)
    const templateString = await readFile(templateFile, 'utf8')
    await writeToFile(templateString, params)
    return `${params.inp_basename}.inp`
  } catch (err) {
    console.log('Something went badly! Unable to generate inp file')
    console.error(err)
  }
}

const generateDynamicsInpFiles = async (params) => {
  const step = (params.rg_max - params.rg_min) / 5
  for (let rg = params.rg_min; rg <= params.rg_max; rg += step) {
    inp_file = `${params.template}_rg${rg}.inp`
    console.log('generateDynamicsInpFiles file:', inp_file)
    params.inp_basename = `${params.template}_rg${rg}`
    params.rg = rg
    await generateInputFile(params)
  }
}

const runMD = async (params) => {
  charmm = process.env.CHARMM
  const step = (params.rg_max - params.rg_min) / 5
  for (let rg = params.rg_min; rg <= params.rg_max; rg += step) {
    inp_file = `${params.template}_rg${rg}.inp`
    out_file = `${params.template}_rg${rg}.out`
    console.log('runDM file:', inp_file)
    const run = spawn(charmm, ['-o', out_file, '-i', inp_file], {
      cwd: params.out_dir
    })
    run.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })

    run.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`)
    })

    run.on('close', (code) => {
      console.log(`CHARMM exited with code ${code}`)
    })
  }
}

const runCHARMM = async (params) => {
  inp_file = path.join(params.out_dir, `${params.template}.inp`)
  out_file = path.join(params.out_dir, `${params.template}.out`)
  // console.log('in: ', inp_file)
  // console.log('out: ', out_file)
  charmm = process.env.CHARMM
  // exec      spawns a new shell
  // execFile  does NOT spawn a new shell
  // spawn     spawns a new process using the given command, with command-line arguments in args.
  // spawnSync will not return until the child process has fully closed.

  const run = spawnSync(charmm, ['-o', out_file, '-i', inp_file], { cwd: params.out_dir })
  //const run = spawnSync('echo', ['Done!!'], { cwd: params.out_dir })
  console.log(run.status)

  // used for spawn----
  // run.stdout.on('data', (data) => {
  //   console.log(`stdout: ${data}`)
  // })

  // run.stderr.on('data', (data) => {
  //   console.error(`stderr: ${data}`)
  // })

  // run.on('close', (code) => {
  //   console.log(`child process exited with code ${code}`)
  // })
}

const countDownTimer = async (message, seconds) => {
  console.log('Start countDownTimer for', seconds, 'sec')
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
  generateInputFile,
  generateDynamicsInpFiles,
  runCHARMM,
  runMD,
  countDownTimer
}
