const Handlebars = require('handlebars')
const { readFile, writeFile } = require('node:fs')
const path = require('path')
const templatePath = path.resolve(__dirname, '../templates/bilbomd')
const emoji = require('node-emoji')

const writeToFile = async (filename, template, params) => {
  // console.log('fn:', filename)
  outFile = path.join(params.out_dir, filename)
  // console.log(outFile)
  var template = Handlebars.compile(template)
  var outputString = template(params)
  await writeFile(outFile, outputString, (err) => {
    if (err) console.error(err)
  })
}

const generateMinimizeInp = (filename, params) => {
  console.log(emoji.get('rocket'), 'generate', filename)

  // read the file and use the callback to render
  readFile(path.join(templatePath, 'minimize.handlebars'), function (err, data) {
    if (!err) {
      var template = data.toString()
      writeToFile(filename, template, params)
      console.log(emoji.get('white_check_mark'), filename, 'written!')
    } else {
      console.error(err)
    }
  })
}

const generateHeatInp = (filename, params) => {
  console.log(emoji.get('rocket'), 'generate', filename)
  // read the file and use the callback to render
  readFile(path.join(templatePath, 'heat.handlebars'), function (err, data) {
    if (!err) {
      var template = data.toString()
      writeToFile(filename, template, params)
      console.log(emoji.get('white_check_mark'), filename, 'written!')
    } else {
      console.error(err)
    }
  })
}

const generateDynamicsInpFiles = (filename, params) => {
  const Rg_step = (params.rg_max - params.rg_min) / 5
  console.log('RG min', params.rg_min)
  console.log('RG max', params.rg_max)
  console.log('RG step', Rg_step)
  for (let i = params.rg_min; i <= params.rg_max; i += Rg_step) {
    // log
    console.log('i:', i, 'min', params.rg_min, 'max', params.rg_max)
  }
}

module.exports = { generateMinimizeInp, generateHeatInp, generateDynamicsInpFiles }
