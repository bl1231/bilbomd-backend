const express = require("express");
const router = express.Router();
const verifyController = require("../controllers/verifyController");

router.post("/", verifyController.verifyNewUser);

module.exports = router;
