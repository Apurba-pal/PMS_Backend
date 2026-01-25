const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },

  password: { type: String, required: true },
  dob: { type: Date, required: true },

  accountStatus: {
    type: String,
    enum: ["UNVERIFIED", "VERIFIED", "DISABLED"],
    default: "UNVERIFIED"
  },

  role: {
    type: String,
    enum: ["PLAYER", "ORGANIZER", "ADMIN"],
    default: "PLAYER"
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
