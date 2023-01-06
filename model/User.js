const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
    },
    roles: {
        User: {
            type: Number,
            default: 2001,
        },
        Editor: Number,
        Admin: Number,
    },
    password: {
        type: String,
        required: true,
    },
    refreshToken: [String],
    email: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["Pending", "Active"],
        default: "Pending",
    },
    confirmationCode: {
        type: String,
        unique: true,
    },
});

module.exports = mongoose.model("User", userSchema);
