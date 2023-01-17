const User = require('../model/User');
const jwt = require('jsonwebtoken');

const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401); // Unauthorized
    const refreshToken = cookies.jwt;
    console.log('----------------------------------------------');
    console.log('got this RT from cookie:', refreshToken);
    console.log('----------------------------------------------');
    //console.log('handleRefreshToken refreshToken:', refreshToken);

    // We are implementing rotating cookies so delete this one
    res.clearCookie('jwt', { httpOnly: true, SameSite: 'none', secure: true }); //secure: true

    const foundUser = await User.findOne({ refreshToken }).exec();
    console.log('handleRefreshToken foundUser:', foundUser);

    //console.log('handleRefreshToken foundUser:', foundUser);
    // Detected refresh token reuse!
    // This would only happen if we did not find a user linked to this refreshToken
    // so we would extract username fromt eh token, and zero out that users refreshToken array as
    // a safety precaution.
    if (!foundUser) {
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            async (err, decoded) => {
                if (err) return res.sendStatus(403); //Forbidden
                const hackedUser = await User.findOne({
                    username: decoded.username
                }).exec();
                console.log('----------------------------------------------');
                console.log(decoded.username, 'attempted refresh token reuse!');
                console.log('----------------------------------------------');
                hackedUser.refreshToken = [];
                const result = await hackedUser.save();
                console.log(result);
            }
        );
        return res.sendStatus(403); //Forbidden
    }

    // valid refreshToken. Time to remove old one and repalce with new one.
    const newRefreshTokenArray = foundUser.refreshToken.filter(
        (rt) => rt !== refreshToken
    );

    // evaluate jwt
    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {
            if (err) {
                console.log('----------------------------------------------');
                console.log('expired refreshToken');
                console.log('----------------------------------------------');
                foundUser.refreshToken = [...newRefreshTokenArray];
                const result = await foundUser.save();
                console.log('----------------------------------------------');
                console.log('verify: ', result);
                console.log('----------------------------------------------');
            }
            if (err || foundUser.username !== decoded.username)
                return res.sendStatus(403);

            // Refresh token was still valid and valid username
            const roles = Object.values(foundUser.roles).filter(Boolean);
            const user = foundUser.username;
            const email = foundUser.email;
            const accessToken = jwt.sign(
                {
                    UserInfo: {
                        username: decoded.username,
                        roles: roles,
                        email: email
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '60sec' }
            );

            const newRefreshToken = jwt.sign(
                { username: foundUser.username },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: '60min' }
            );
            // Saving refreshToken with current user
            foundUser.refreshToken = [...newRefreshTokenArray, newRefreshToken];
            const result = await foundUser.save();
            console.log('----------------------------------------------');
            console.log('save refreshToken', result);
            console.log('----------------------------------------------');

            // Creates Secure Cookie with refresh token
            res.cookie('jwt', newRefreshToken, {
                httpOnly: true,
                SameSite: 'none',
                secure: true,
                maxAge: 24 * 60 * 60 * 1000
            }); //secure: true,

            //res.json({ roles, accessToken });
            res.json({ user, email, roles, accessToken });
        }
    );
};

module.exports = { handleRefreshToken };
