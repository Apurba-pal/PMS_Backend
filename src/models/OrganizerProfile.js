const mongoose = require("mongoose");
const organizerProfileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    name: { type: String, required: true },

    type: {
      type: String,
      enum: ["INDIVIDUAL", "ORGANIZATION", "COLLEGE", "COMMUNITY"],
      required: true,
    },

    contactEmail: String,
    contactPhone: String,
    region: String,

    logo: String,
    logoPublicId: String,

    description: String,

    status: {
      type: String,
      enum: ["UNVERIFIED", "VERIFIED", "SUSPENDED"],
      default: "UNVERIFIED",
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("OrganizerProfile", organizerProfileSchema);
