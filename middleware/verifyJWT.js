const jwt = require('jsonwebtoken');

const verifyJWT = (req, res, next) => {
  // apparently the authorization heaer can arrive with either an UPPER or lowercase A
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
  //console.log('AUTH-HEADER: ', authHeader); // Bearer token
  const token = authHeader.split(' ')[1]; // grab just the token from above string
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.sendStatus(403);
      console.log('error in verifyJWT', decoded);
    }
    req.user = decoded.UserInfo.username;
    req.email = decoded.UserInfo.email;
    req.roles = decoded.UserInfo.roles;
    //console.log('verifyJWT', req.user, req.email, req.roles);
    next();
  });
};

module.exports = verifyJWT;
