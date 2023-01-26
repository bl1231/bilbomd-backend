const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const uploadFolder = path.join(__dirname, '../uploads');

const handlePdbFileUpload = async (req, res) => {
  //console.log(req.headers);
  console.log(req.fields);
  console.log(req.files);
  // do something with the file here.
  // This will only be used if I decide to have each PDB uploaded as the user adds it to the form
  // For now calculate a UUID and send it back.
  res.json({
    //fields: req.fields,
    uuid: uuid()
  });
};

const handleBilbomdFormUpload = async (req, res) => {
  const form = new formidable.IncomingForm();
  const files = [];
  const fields = [];
  form.multiples = true;
  form.keepExtensions = true;
  form.maxFileSize = 50 * 1024 * 1024; //5MB
  form.uploadDir = uploadFolder;

  // create a unique folder for each job submission
  const jobFolder = uuid();

  fs.mkdir(path.join(form.uploadDir, jobFolder), (err) => {
    if (err) {
      return console.error(err);
    }
    console.log(`${jobFolder} directory created successfully!`);
  });

  form
    .on('field', (fieldName, value) => {
      //console.log(fieldName, value);
      // Need to capture the non-file field values here
      fields.push({ fieldName, value });
    })
    .on('fileBegin', (fieldName, file) => {
      // accessible here
      // fieldName the name in the form (<input name="thisname" type="file">) or http filename for octetstream
      // file.originalFilename http filename or null if there was a parsing error
      // file.newFilename generated hexoid or what options.filename returned
      // file.filepath default pathnme as per options.uploadDir and options.filename
      // file.filepath = CUSTOM_PATH // to change the final path
      file.filepath = path.join(form.uploadDir, jobFolder, file.originalFilename);
    })
    .on('file', (fieldName, file) => {
      // same as fileBegin, except
      // it is too late to change file.filepath
      // file.hash is available if options.hash was used
      console.log(fieldName, file);
      files.push({ fieldName, file });
    })
    .on('end', () => {
      console.log('-> upload done');
      // res.writheead(200, { 'Content-Type': 'text/plain' });
      // res.write(`received fields:\n\n${util.inspect(fields)}`);
      // res.write('\n\n');
      // res.end(`received files:\n\n${util.inspect(files)}`);
    });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.log('Error parsing files');
      return res.status(400).json({
        status: 'Fail',
        message: 'There was a problem parsing the uploaded files',
        error: err
      });
    }
    try {
      console.log(fields);
      //initialize object to write comm1.txt
      // var comm = {};
      // comm.directory = uniqueDir; //upload directory
      // comm.email; //users email address
      // comm.expt; //experimental data filename
      // comm.maxQ; //max q value
      // comm.confLength; // length of conformational sampling
      // comm.rgMin; //min Rg
      // comm.rgMax; //max Rg
      // comm.pdbNum; //number of pdbs
      // comm.pdbNames = []; //list of pdb filenames
      // comm.title; // name of experiment
      // comm.status = 'Running';
      // comm.zipfile; //name of results zipfile once run has completed
      // comm.startDate;
      //

      fields.uuid = jobFolder;

      const json = JSON.stringify(fields);

      const bilbomdFile = path.join(form.uploadDir, jobFolder, 'bilbomd.json');

      fs.writeFile(bilbomdFile, json, (err) => {
        if (err) throw err;
        console.log('bilbomd.json file has been saved');
      });
    } catch (error) {
      console.log(error);
    }
  });
  // // const file = req.body;
  // console.log(req.fields);
  // console.log(req.files);
  // console.log('Experimental Data: ', req.files?.expdata?.originalFilename);
  // console.log('const.inp file: ', req.files?.constinp?.originalFilename);
  // const form = new formidable.IncomingForm();
  // // do some stuff with form here.
  // // add to RabbitMQ
  // // put stuff in MongoDB
  return res.status(201).json({
    status: 'success',
    message: 'did it'
  });
};

module.exports = { handlePdbFileUpload, handleBilbomdFormUpload };
