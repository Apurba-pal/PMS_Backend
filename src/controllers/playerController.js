const PlayerProfile = require("../models/PlayerProfile");

exports.createProfile = async (req, res) => {
  const exists = await PlayerProfile.findOne({ user: req.user });
  if (exists) return res.status(400).json({ message: "Profile already exists" });

  const profile = await PlayerProfile.create({
    user: req.user,
    ...req.body
  });

  res.status(201).json(profile);
};

exports.getMyProfile = async (req, res) => {
  const profile = await PlayerProfile.findOne({ user: req.user }).populate("user", "name email username phone");

  if (!profile) return res.status(404).json({ message: "Profile not found" });

  res.json(profile);
};

exports.updateProfile = async (req, res) => {
  const profile = await PlayerProfile.findOne({ user: req.user });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const allowedUpdates = [
    "state",
    "profilePhoto",
    "gameUID",
    "inGameName",
    "profileQR",
    "roles",
    "playerStatus"
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      profile[field] = req.body[field];
    }
  });

  await profile.save();

  res.json(profile);
};
