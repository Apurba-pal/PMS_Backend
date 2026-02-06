const mongoose = require("mongoose");

const rosterPlayerSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  playstyleRole: {
    type: String,
    enum: ["PRIMARY", "SECONDARY", "SNIPER", "NADER"],
    required: true
  }
}, { _id: false });

const tournamentRegistrationSchema = new mongoose.Schema({

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

  // 🔥 Tournament-specific roster (NOT auto squad snapshot)
  roster: {
    type: [rosterPlayerSchema],
    validate: v => v.length >= 1
  },

  // Roster locked at registration time
  isRosterLocked: {
    type: Boolean,
    default: true
  },

  registrationStatus: {
    type: String,
    enum: ["REQUESTED", "APPROVED", "REJECTED", "DISQUALIFIED"],
    default: "REQUESTED"
  },


  /* 🟡 REJECTION DETAILS */
  rejection: {
    reason: String,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: Date
  },

  /* 🔴 DISQUALIFICATION DETAILS */
  disqualification: {
    reason: String,
    proofUrl: String,
    disqualifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    disqualifiedAt: Date
  }

}, { timestamps: true });

module.exports = mongoose.model("TournamentRegistration", tournamentRegistrationSchema);
