const User = require('../model/User');
const { v4: uuid } = require('uuid');
//const sendConfirmationEmail = require('../config/nodemailerConfig');
const { sendVerificationEmail } = require('../config/nodemailerConfig');
const characters =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const conformationURL = 'http://localhost:3001';

const handleNewUser = async (req, res) => {
    console.log('handleNewUser', req.body);
    const { user, email } = req.body;
    if (!user || !email)
        return res.status(400).json({
            message: 'Username and email are required.'
        });

    // check for duplicate usernames in the db
    const duplicate = await User.findOne({ email: email }).exec();
    console.log('DUP FOUND', duplicate);
    if (duplicate) return res.sendStatus(409); //Conflict

    try {
        //create a unique confirmation code
        let confirmationCode = '';
        for (let i = 0; i < 30; i++) {
            confirmationCode +=
                characters[Math.floor(Math.random() * characters.length)];
        }

        // unique UUID for each user
        const UUID = uuid();

        //create and store the new user
        const result = await User.create({
            username: user,
            email: email,
            confirmationCode: confirmationCode,
            UUID: UUID,
            createdAt: Date()
        });

        //send Verification email
        sendVerificationEmail(email, conformationURL, confirmationCode);
        console.log(result);

        res.status(201).json({ success: `New user ${user} created!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { handleNewUser };
