const User = require('../model/User');

const handleNewUser = async (req, res) => {
    const { user, email } = req.body;
    if (!user || !email) return res.status(400).json({ 'message': 'Username and email are required.' });
    // check for duplicate usernames or email in the "DB"
    const duplicateEmail = await User.findOne({email: email}).exec();
    const duplicateUsername = await User.findOne({username: user}).exec();
    if (duplicateEmail || duplicateUsername) return res.sendStatus(409); //Conflict 
    try {
        //encrypt the password
        // const hashedPwd = await bcrypt.hash(pwd, 10);
        //store the new user
        // set user_validated to false
        // send email

        //create and store the new user
        const result = await User.create({
            "username": user,
            "email": email,
        });

        // could do this too
        //const newUser = new User();
        //newUser.email = email;
        //const result2 = await newUser.save();

        console.log(result)


        res.status(201).json({ 'success': `New user ${user} created!` });
    } catch (err) {
        res.status(500).json({ 'message': err.message }); //Server Error
    }
}

module.exports = { handleNewUser };