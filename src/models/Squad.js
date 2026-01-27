const mongoose = require("mongoose");

const squadMemberSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  isIGL: {
    type: Boolean,
    default: false
  },
  playstyleRole: {
    type: String,
    enum: ["PRIMARY", "SECONDARY", "SNIPER", "NADER"],
    required: true
  }
});

// Prevent duplicate player inside same squad
squadMemberSchema.index({ player: 1 });

const squadSchema = new mongoose.Schema({
  squadName: { type: String, required: true, unique: true },
  logo: String,
  logoPublicId: String,
  game: { type: String, required: true },
  members: [squadMemberSchema],

  minSize: { type: Number, default: 4 },
  maxSize: { type: Number, default: 6 },

  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "DISBANDED"],
    default: "ACTIVE"
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Squad", squadSchema);
