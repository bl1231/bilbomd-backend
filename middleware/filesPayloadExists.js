const filesPayloadExists = (req, res, next) => {
  console.log('filesPayloadExists', req.files);
  if (!req.files)
    return res.status(400).json({ status: 'error', message: 'Missing files' });

  next();
};

module.exports = filesPayloadExists;
