const mongoose = require("mongoose");

const squadResultSchema = new mongoose.Schema({
  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Squad",
    required: true
  },
  kills: { type: Number, default: 0 },
  placement: { type: Number, required: true }, // 1st, 2nd, 3rd...
}, { _id: false });

const tournamentMatchSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    required: true
  },

  matchNumber: Number,
  mapName: String,
  roomId: String,
  roomPassword: String,

  results: [squadResultSchema],

  status: {
    type: String,
    enum: ["PENDING", "COMPLETED"],
    default: "PENDING"
  }

}, { timestamps: true });

module.exports = mongoose.model("TournamentMatch", tournamentMatchSchema);
