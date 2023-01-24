const express = require('express');
const router = express.Router();
const formidable = require('formidable');
const uploadController = require('../controllers/uploadController');

// router.use(function (req, res, next) {
//   console.log(req.fields);
//   console.log(req.files);
//   next();
// });

// const formMiddleWare = (req, res, next) => {
//   const form = formidable({});

//   form.parse(req, (err, fields, files) => {
//     if (err) {
//       next(err);
//       return;
//     }
//     req.fields = fields;
//     req.files = files;
//     next();
//   });
// };

router.use((req, res, next) => {
  const form = formidable({});

  form.parse(req, (err, fields, files) => {
    if (err) {
      next(err);
      return;
    }
    req.fields = fields;
    req.files = files;
    next();
  });
});

router.post('/pdb', uploadController.handlePdbFileUpload);
router.post('/', uploadController.handleBilbomdFormUpload);

module.exports = router;
