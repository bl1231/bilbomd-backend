const User = require('../model/User');
const jwt = require('jsonwebtoken');

const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401); // optional chaining
    console.log("received refreshToken:",cookies.jwt);
    const refreshToken = cookies.jwt;

    // const foundUser = usersDB.users.find(person => person.refreshToken === refreshToken);
    const foundUser = await User.findOne({refreshToken}).exec();
    console.log('FOUND: ',foundUser);
    if (!foundUser) return res.sendStatus(403); //Forbidden 
    // evaluate jwt 
    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err, decoded) => {
            console.log('refreshToken for: ',decoded.email);
            if (err || foundUser.email !== decoded.email) return res.sendStatus(403);
            const roles = Object.values(foundUser.roles)
            const accessToken = jwt.sign(
                {
                    "UserInfo": {
                        "email": decoded.email,
                        "roles": roles
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '60s' } //30s for testing 30d for production
            );
            res.json({ accessToken });
        }
    );
}

module.exports = { handleRefreshToken }