const mongoose = require("mongoose");

const verificationRequestSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true // one active request per player (overwritten on re-submit)
    },

    idProofUrl: { type: String, required: true },
    idProofPublicId: { type: String, required: true },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING"
    },

    adminNote: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("VerificationRequest", verificationRequestSchema);
