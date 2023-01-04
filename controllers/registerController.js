const usersDB = {
    users: require('../model/users.json'),
    setUsers: function (data) { this.users = data }
}
const fsPromises = require('fs').promises;
const path = require('path');
// const bcrypt = require('bcrypt');

const handleNewUser = async (req, res) => {
    const { user, email } = req.body;
    if (!user || !email) return res.status(400).json({ 'message': 'Username and email are required.' });
    // check for duplicate usernames or email in the "DB"
    // How to connect to MariaDB?
    const duplicateEmail = usersDB.users.find(person => person.email === email);
    const duplicateUsername = usersDB.users.find(person => person.username === user);
    if (duplicateEmail || duplicateUsername) return res.sendStatus(409); //Conflict 
    try {
        //encrypt the password
        // const hashedPwd = await bcrypt.hash(pwd, 10);
        //store the new user
        // set user_validated to false
        // send email
        const newUser = {
            "username": user,
            "roles": { "User": 2001 },
            "email": email,
        };
        usersDB.setUsers([...usersDB.users, newUser]);
        await fsPromises.writeFile(
            path.join(__dirname, '..', 'model', 'users.json'),
            JSON.stringify(usersDB.users)
        );
        console.log(usersDB.users);
        res.status(201).json({ 'success': `New user ${user} created!` });
    } catch (err) {
        res.status(500).json({ 'message': err.message }); //Server Error
    }
}

module.exports = { handleNewUser };