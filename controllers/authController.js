const User = require('../model/User');
const jwt = require('jsonwebtoken');

const handleLogin = async (req, res) => {
  const { email } = req.body;
  console.log('login with email:', email)
  if (!email) return res.status(400).json({ 'message': 'Email is required.' });
  
  // Check for user in DB
  const foundUser = await User.findOne({email: email}).exec();
  if (!foundUser) return res.sendStatus(401); //Unauthorized ...please register

  // Check if User is Verified - here? probably not
  //if (foundUser.status != "Active") {
  //  return res.status(401).json({'message': 'Pending Account. Please Verify Your Email'});
  //}
  if (foundUser) {
    const roles = Object.values(foundUser.roles);
    // create JWTs
    // access token - short lived - only store in memory 
    // refresh token - long lived - send as httpOnly cookie - not accessible via JS. expire after N months.
    // only store access token in memory - for security 
    const accessToken = jwt.sign(
      {
        "UserInfo": {
          "username": foundUser.username,
          "email": foundUser.email,
          "roles": roles
        }
      },
      process.env.ACCESS_TOKEN_SECRET,
      {expiresIn: '30s'}
    );
    const refreshToken = jwt.sign(
      { "email": foundUser.email },
      process.env.REFRESH_TOKEN_SECRET,
      {expiresIn: '1d'}
    );
    // Save refreshToken to "DB" so we can logout later
    foundUser.refreshToken = refreshToken;
    const result = await foundUser.save();
    console.log(result);

    res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: "", maxAge: 24 * 60 * 60 * 1000 }); // secure: true,
    res.json({ accessToken });
    console.log('accessToken\t', accessToken)
    console.log('refreshToken\t', refreshToken)
  } else {
      res.sendStatus(401);
  }
}

module.exports = { handleLogin };