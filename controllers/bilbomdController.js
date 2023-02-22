const Handlebars = require('handlebars')
const { readFile, writeFile } = require('node:fs/promises')
const { spawn, exec } = require('node:child_process')
const path = require('path')
const templatePath = path.resolve(__dirname, '../templates/bilbomd')
const emoji = require('node-emoji')
// emoji.get('rocket')
// emoji.get('white_check_mark')

const writeToFile = async (templateString, params) => {
  outFile = path.join(params.out_dir, `${params.template}.inp`)
  console.log('writeToFile', outFile)
  var template = Handlebars.compile(templateString)
  var outputString = template(params)
  await writeFile(outFile, outputString, (err) => {
    if (err) console.error(err)
  })
}

const generateInputFile = async (params) => {
  console.log(`Start generateInputFile for: ${params.template}.inp`)
  try {
    const templateFile = path.join(templatePath, `${params.template}.handlebars`)
    //console.log(templateFile)
    const templateString = await readFile(templateFile, 'utf8')
    //console.log(template)
    writeToFile(templateString, params)
  } catch (err) {
    console.error(err)
  }
}

const generateDynamicsInpFiles = async (params) => {
  const Rg_step = (params.rg_max - params.rg_min) / 5
  // console.log('generateDynamicsInpFiles RG min', params.rg_min)
  // console.log('generateDynamicsInpFiles RG max', params.rg_max)
  // console.log('generateDynamicsInpFiles RG step', Rg_step)
  for (let i = params.rg_min; i <= params.rg_max; i += Rg_step) {
    inp_file = `${params.template}_${i}.inp`
    console.log('generateDynamicsInpFiles file:', inp_file)
    //await generateInputFile()
  }
}

const runCHARMM = async (params) => {
  inp_file = path.join(params.out_dir, `${params.template}.inp`)
  charmm = process.env.CHARMM
  // exec      spawns a new shell
  // execFile  does NOT spawn a new shell
  // spawn     spawns a new process using the given command, with command-line arguments in args.

  spawn(inp_file, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`)
      return
    }
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  })
}

const countDownTimer = async (seconds) => {
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
  await go.do('countDownTimer', seconds)
  console.log('Finished countDownTimer')
}

module.exports = {
  generateInputFile,
  generateDynamicsInpFiles,
  runCHARMM,
  countDownTimer
}
