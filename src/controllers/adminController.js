const User = require("../models/User");
const PlayerProfile = require("../models/PlayerProfile");
const VerificationRequest = require("../models/VerificationRequest");

// ─── GET /api/admin/verifications ──────────────────────────────────────────
exports.getAllVerificationRequests = async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status.toUpperCase();

  const requests = await VerificationRequest.find(filter)
    .populate("player", "name username email accountStatus")
    .sort({ createdAt: -1 });

  res.json(requests);
};

// ─── GET /api/admin/verifications/:id ──────────────────────────────────────
exports.getVerificationRequestById = async (req, res) => {
  const request = await VerificationRequest.findById(req.params.id).populate(
    "player",
    "name username email phone dob accountStatus"
  );

  if (!request)
    return res.status(404).json({ message: "Verification request not found" });

  // Also grab the player profile for extra context (UID, in-game name, QR)
  const profile = await PlayerProfile.findOne({ user: request.player._id }).select(
    "gameUID inGameName profileQR roles"
  );

  res.json({ request, profile });
};

// ─── PATCH /api/admin/verifications/:id ────────────────────────────────────
exports.reviewVerificationRequest = async (req, res) => {
  const { status, adminNote } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
  }

  const request = await VerificationRequest.findById(req.params.id);
  if (!request)
    return res.status(404).json({ message: "Verification request not found" });

  request.status = status;
  request.adminNote = adminNote || "";
  await request.save();

  // Sync User.accountStatus
  const newAccountStatus = status === "APPROVED" ? "VERIFIED" : "UNVERIFIED";
  await User.findByIdAndUpdate(request.player, {
    accountStatus: newAccountStatus
  });

  res.json({ message: `Request ${status.toLowerCase()}`, request });
};

// ─── GET /api/admin/players ─────────────────────────────────────────────────
exports.getAllPlayers = async (req, res) => {
  const users = await User.find({ role: "PLAYER" })
    .select("name username email accountStatus createdAt")
    .sort({ createdAt: -1 });

  // Attach basic profile info
  const playerIds = users.map((u) => u._id);
  const profiles = await PlayerProfile.find({ user: { $in: playerIds } }).select(
    "user gameUID inGameName profilePhoto roles"
  );

  const profileMap = {};
  profiles.forEach((p) => {
    profileMap[p.user.toString()] = p;
  });

  const result = users.map((u) => ({
    ...u.toObject(),
    profile: profileMap[u._id.toString()] || null
  }));

  res.json(result);
};

// ─── PATCH /api/admin/players/:id/disable ────────────────────────────────
exports.togglePlayerDisable = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.accountStatus === "DISABLED") {
    user.accountStatus = "UNVERIFIED";
  } else {
    user.accountStatus = "DISABLED";
  }

  await user.save();
  res.json({ message: `Account ${user.accountStatus}`, accountStatus: user.accountStatus });
};
