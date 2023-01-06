const User = require("../model/User");
const bcrypt = require("bcrypt");
const characters =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const handleNewUser = async (req, res) => {
    const { user, pwd, email } = req.body;
    if (!user || !pwd || !email)
        return res.status(400).json({
            message: "Username, email, and password are all required.",
        });

    // check for duplicate usernames in the db
    const duplicate = await User.findOne({ username: user }).exec();
    if (duplicate) return res.sendStatus(409); //Conflict

    try {
        //encrypt the password
        const hashedPwd = await bcrypt.hash(pwd, 10);

        //create a unique confirmation code
        let confirmationCode = "";
        for (let i = 0; i < 30; i++) {
            confirmationCode +=
                characters[Math.floor(Math.random() * characters.length)];
        }

        //create and store the new user
        const result = await User.create({
            username: user,
            password: hashedPwd,
            email: email,
            confirmationCode: confirmationCode,
        });

        console.log(result);

        res.status(201).json({ success: `New user ${user} created!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { handleNewUser };
