const User = require('../model/User');
const jwt = require('jsonwebtoken');

const handleLogin = async (req, res) => {
    const cookies = req.cookies;
    console.log('----------------------------------------------');
    console.log(`cookie available at login: ${JSON.stringify(cookies)}`);
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email required.' });

    // query MongoDB on email
    const foundUser = await User.findOne({ email: email }).exec();
    if (!foundUser) return res.sendStatus(401); //Unauthorized

    // Check if user has confirmationCode,

    // Check if we found an entry in MongoDB with this email
    const match = email === foundUser.email;
    if (match) {
        // Grab values from the MongoDB Document we retrieved.
        const roles = Object.values(foundUser.roles).filter(Boolean);
        const user = foundUser.username;
        const email = foundUser.email;

        // create JWTs
        console.log(user, email, roles);
        // accessToken - memory only, short lived, allows access to protected routes
        const accessToken = jwt.sign(
            {
                UserInfo: {
                    username: user,
                    roles: roles,
                    email: email
                }
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '60s' }
        );
        // refreshToken - http only, secure, allows for refresh of expired accessTokens
        const newRefreshToken = jwt.sign(
            { username: foundUser.username },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '60min' }
        );

        // Changed to let keyword
        let newRefreshTokenArray = !cookies?.jwt
            ? foundUser.refreshToken
            : foundUser.refreshToken.filter((rt) => rt !== cookies.jwt);

        if (cookies?.jwt) {
            /* 
            Scenario added here: 
                1) User logs in but never uses RT and does not logout 
                2) RT is stolen
                3) If 1 & 2, reuse detection is needed to clear all RTs when user logs in
            */
            // const refreshToken = cookies.jwt;
            // const foundToken = await User.findOne({ refreshToken }).exec();

            // // Detected refresh token reuse!
            // if (!foundToken) {
            //     console.log('attempted refresh token reuse at login!');
            //     // clear out ALL previous refresh tokens
            //     newRefreshTokenArray = [];
            // }

            res.clearCookie('jwt', {
                httpOnly: true,
                SameSite: 'none',
                secure: true
            }); //secure: true
        }

        // Saving refreshToken with current user
        foundUser.refreshToken = [...newRefreshTokenArray, newRefreshToken];
        const result = await foundUser.save();
        console.log('----------------------------------------------');
        console.log('authController', result);
        //console.log(roles);

        // Creates Secure Cookie with our refreshToken
        res.cookie('jwt', newRefreshToken, {
            httpOnly: true,
            SameSite: 'none',
            secure: true,
            maxAge: 24 * 60 * 60 * 1000
        }); // secure: true,

        // Send authorization roles and access token to user
        res.json({ user, email, roles, accessToken });
    } else {
        res.sendStatus(401); //Unauthorized
    }
};

module.exports = { handleLogin };
