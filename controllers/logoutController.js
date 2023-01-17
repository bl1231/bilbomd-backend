const User = require('../model/User');

const handleLogout = async (req, res) => {
    // On client, also delete the accessToken

    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204); //No content
    const refreshToken = cookies.jwt;

    // Is refreshToken in db?
    const foundUser = await User.findOne({ refreshToken }).exec();
    if (!foundUser) {
        // deletes refreshToken in the request
        res.clearCookie('jwt', {
            httpOnly: true,
            SameSite: 'none',
            secure: true
        }); //secure: true
        return res.sendStatus(204); //No content
    }

    // Delete refreshToken in DB
    foundUser.refreshToken = foundUser.refreshToken.filter(
        (rt) => rt !== refreshToken
    );
    const result = await foundUser.save();
    console.log('-------------------------');
    console.log('logoutController:', result);
    console.log('-------------------------');

    res.clearCookie('jwt', { httpOnly: true, SameSite: 'none', secure: true }); //secure: true
    res.sendStatus(204); //All is well, but No content
};

module.exports = { handleLogout };
