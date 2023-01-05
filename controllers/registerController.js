const User = require("../model/User");
const jwt = require("jsonwebtoken");
const sendConfirmationEmail = require("../config/nodemailerConfig");

const handleNewUser = async (req, res) => {
  const { user, email } = req.body;
  if (!user || !email)
    return res
      .status(400)
      .json({ message: "Username and email are required." });
  // check for duplicate usernames or email in the "DB"
  const duplicateEmail = await User.findOne({ email: email }).exec();
  const duplicateUsername = await User.findOne({ username: user }).exec();
  if (duplicateEmail || duplicateUsername) return res.sendStatus(409); //Conflict
  try {
    //create a confirmation code that lasts for 1 hour
    const confirmationToken = jwt.sign(
      {
        UserInfo: {
          email: email,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    //create and store the new user
    //status is set to "Pending" by default
    const result = await User.create({
      username: user,
      email: email,
      confirmationCode: confirmationToken,
    });

    console.log(result);

    //send email
    sendConfirmationEmail(email, confirmationToken);

    res.status(201).json({ success: `New user ${user} created!` });
  } catch (err) {
    res.status(500).json({ message: err.message }); //Server Error
  }
};

module.exports = { handleNewUser };
