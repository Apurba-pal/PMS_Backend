const mongoose = require("mongoose");

const squadInviteSchema = new mongoose.Schema({
  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Squad",
    required: true
  },
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "REJECTED"],
    default: "PENDING"
  }
}, { timestamps: true });

module.exports = mongoose.model("SquadInvite", squadInviteSchema);
