const mongoose = require("mongoose");

const tournamentStandingSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    required: true
  },

  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Squad",
    required: true
  },

  kills: { type: Number, default: 0 },
  placementPoints: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },

  totalPoints: { type: Number, default: 0 }

}, { timestamps: true });

module.exports = mongoose.model("TournamentStanding", tournamentStandingSchema);
