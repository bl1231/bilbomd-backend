const express = require('express');
const router = express.Router();
const os = require('os')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

console.log('root\t\trouter loaded')


module.exports = router;
