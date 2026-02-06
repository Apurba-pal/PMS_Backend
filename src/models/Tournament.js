const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: String, required: true },

  organizerProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrganizerProfile",
    required: true
  },

  createdByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  lifecycleStatus: {
    type: String,
    enum: [
      "DRAFT",
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "ONGOING",
      "COMPLETED",
      "RESULTS_FINALIZED",
      "CANCELLED"
    ],
    default: "DRAFT"
  },

  registrationControl: {
    type: String,
    enum: ["OPEN", "CLOSED"],
    default: "CLOSED"
  },

  eligibilityRules: {
    minSquadSize: { type: Number, default: 4 },
    maxSquadSize: { type: Number, default: 6 },
    allowedSubstitutes: { type: Number, default: 2 },
    minAge: Number,
    region: String
  },

  registrationStart: Date,
  registrationEnd: Date,
  tournamentStart: Date,
  tournamentEnd: Date,

    // 🔥 External comms (Discord / WhatsApp / etc)
  externalCommsLink: {
    type: String
  }

}, { timestamps: true });

module.exports = mongoose.model("Tournament", tournamentSchema);
