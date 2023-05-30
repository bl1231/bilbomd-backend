const jwt = require('jsonwebtoken')

const verifyJWT = (req, res, next) => {
  // apparently the authorization header can arrive with either an UPPER or lowercase Aa
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
    // return res.sendStatus(401)
  }

  const token = authHeader.split(' ')[1]

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden --' })
    req.user = decoded.UserInfo.username
    req.roles = decoded.UserInfo.roles
    next()
  })
}

module.exports = verifyJWT
