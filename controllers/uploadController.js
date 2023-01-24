const formidable = require('formidable');
const { v4: uuid } = require('uuid');

const handlePdbFileUpload = async (req, res) => {
  //console.log(req.headers);
  console.log(req.fields);
  console.log(req.files);
  // do something with the file here.
  res.json({
    //fields: req.fields,
    uuid: uuid()
  });
};

const handleBilbomdFormUpload = async (req, res) => {
  // const file = req.body;
  console.log(req.fields);
  console.log(req.files);
  console.log('name1: ', req.files.expdata.originalFilename);
  console.log('name2: ', req.files.constinp.originalFilename);
  // do some stuff with form here.
  // add to RabbitMQ
  // put stuff in MongoDB
  return res.status(201).json({
    status: 'success',
    message: 'did it'
  });
};

module.exports = { handlePdbFileUpload, handleBilbomdFormUpload };
