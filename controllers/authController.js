const usersDB = {
    users: require('../model/users.json'),
    setUsers: function (data) { this.users = data }
}

const jwt = require('jsonwebtoken');
const fsPromises = require('fs').promises;
const path = require('path');

const handleLogin = async (req, res) => {
  const { email } = req.body;
  console.log('received email:', email)
  if (!email) return res.status(400).json({ 'message': 'Email is required.' });
  // 
  const foundUser = usersDB.users.find(person => person.email === email);
  if (!foundUser) return res.sendStatus(401); //Unauthorized ...please register
  // evaluate password 
  //const match = await bcrypt.compare(pwd, foundUser.password);

  console.log(process.env)
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
    const otherUsers = usersDB.users.filter(person => person.email !== foundUser.email);
    const currentUser = { ...foundUser, refreshToken };
    usersDB.setUsers([...otherUsers, currentUser]);
    await fsPromises.writeFile(
        path.join(__dirname, '..', 'model', 'users.json'),
        JSON.stringify(usersDB.users)
    );

    res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: "", secure: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ accessToken });
    console.log('accessToken\t', accessToken)
    console.log('refreshToken\t', refreshToken)
  } else {
      res.sendStatus(401);
  }
}

module.exports = { handleLogin };