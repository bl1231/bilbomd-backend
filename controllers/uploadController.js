const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const Job = require('../model/Job');
const User = require('../model/User');
const emoji = require('node-emoji');

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
  //console.log(req);

  const form = new formidable.IncomingForm();
  const files = [];
  const fields = [];
  form.multiples = true;
  form.keepExtensions = true;
  form.maxFileSize = 500 * 1024 * 1024; //5MB
  form.uploadDir = uploadFolder;

  // create a unique folder for each job submission
  const UUID = uuid();

  fs.mkdir(path.join(form.uploadDir, UUID), (err) => {
    if (err) {
      return console.error(err);
    }
    console.log(`${UUID} directory created successfully!`);
  });

  form
    .on('field', (fieldName, value) => {
      // Capture the non-file field values here
      fields.push({ fieldName, value });
    })
    .on('fileBegin', (fieldName, file) => {
      // accessible here
      // fieldName the name in the form (<input name="thisname" type="file">) or http filename for octetstream
      // file.originalFilename http filename or null if there was a parsing error
      // file.newFilename generated hexoid or what options.filename returned
      // file.filepath default pathname as per options.uploadDir and options.filename
      // file.filepath = CUSTOM_PATH // to change the final path
      file.filepath = path.join(form.uploadDir, UUID, file.originalFilename);
    })
    .on('file', (fieldName, file) => {
      // same as fileBegin, except
      // it is too late to change file.filepath
      // file.hash is available if options.hash was used
      //console.log(fieldName, file);
      files.push({ fieldName, file });
    })
    .on('progress', (bytesReceived, bytesExpected) => {
      // what do I do in here?
    })
    .on('end', () => {
      console.log(emoji.get('white_check_mark'), 'upload done');
      // res.writheead(200, { 'Content-Type': 'text/plain' });
      // res.write(`received fields:\n\n${util.inspect(fields)}`);
      // res.write('\n\n');
      // res.end(`received files:\n\n${util.inspect(files)}`);
      //msg = `received fields:\n\n${fields}`;
      //res.status(200).json({ message: msg });
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

      const email = 'scott.classen@gmail.com';
      const foundUser = await User.findOne({ email: email }).exec();
      if (!foundUser) return res.sendStatus(401); //Unauthorized

      // Create new job
      const newJob = await Job.create({
        title: fields.title,
        uuid: UUID,
        const_inp_file: files.constinp.originalFilename,
        data_file: files.expdata.originalFilename,
        conformational_sampling: fields.num_conf,
        rg_min: fields.rg_min,
        rg_max: fields.rg_max,
        status: 'Submitted',
        time_submitted: Date(),
        user: foundUser
      });
      console.log(newJob);

      // Also add this new job to the user's jobs array
      foundUser.jobs.push(newJob);
      const userResult = await foundUser.save();

      // add UUID to fields obj before we turn it into JSON
      fields.uuid = UUID;

      const json = JSON.stringify(fields);

      const bilbomdFile = path.join(form.uploadDir, UUID, 'bilbomd.json');

      result = fs.writeFile(bilbomdFile, json, (err) => {
        if (err) throw err;
        console.log('bilbomd.json file has been saved');
      });

      // send res
      res.status(200).json({ message: 'success' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error });
    }
  });

  // return res.status(201).json({
  //   status: 'success',
  //   message: 'did it',
  // });
};

module.exports = { handlePdbFileUpload, handleBilbomdFormUpload };
