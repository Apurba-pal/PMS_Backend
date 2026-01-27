const mongoose = require("mongoose");

const playerProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  state: String,
  profilePhoto: String,
  profilePhotoPublicId: String,

  gameUID: String,
  inGameName: String,
  profileQR: String,

  roles: [{
  type: String,
  enum: ["PRIMARY", "SECONDARY", "SNIPER", "NADER", "IGL"]
}],


  currentSquad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Squad",
    default: null
  },
  previousSquads: [
  {
    type: String
  }
],

  playerStatus: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "FREE_AGENT"],
    default: "ACTIVE"
  }

}, { timestamps: true });

module.exports = mongoose.model("PlayerProfile", playerProfileSchema);
