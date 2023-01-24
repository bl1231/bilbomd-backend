const User = require('../model/User');
const characters =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const { sendMagickLinkEmail } = require('../config/nodemailerConfig');
const magicklinkURL = 'http://localhost:3001';
const generateMagickLink = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ messge: 'email is required' });
    }

    const foundUser = await User.findOne({ email: email }).exec();
    if (!foundUser) return res.sendStatus(401); // unauthorized.
    try {
        // generate a 34 character One Time Password (OTP)
        let otp = '';
        for (let i = 0; i < 34; i++) {
            otp += characters[Math.floor(Math.random() * characters.length)];
        }
        // add OTP to the Users MongoDB entry
        foundUser.otp = otp;
        const result = await foundUser.save();
        console.log(result);

        //send MagickLink email
        sendMagickLinkEmail(email, magicklinkURL, otp);

        res.status(201).json({ success: `OTP created for ${email}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { generateMagickLink };