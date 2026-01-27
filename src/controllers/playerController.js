const PlayerProfile = require("../models/PlayerProfile");
const { uploadImage } = require("../utils/uploadToCloudinary");
const { deleteImage } = require("../utils/deleteFromCloudinary");

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

exports.searchPlayers = async (req, res) => {
  const { q, role } = req.query;

  if (!q && !role)
    return res.status(400).json({ message: "Search query required" });

  const query = {};

  if (role) query.roles = role;

  if (q) {
    query.$or = [
      { inGameName: { $regex: q, $options: "i" } },
      { gameUID: { $regex: q, $options: "i" } }
    ];
  }

  const players = await PlayerProfile.find(query)
    .populate("user", "name username email")
    .select("-profileQR");

  res.json(players);
};

exports.uploadProfilePhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const profile = await PlayerProfile.findOne({ user: req.user });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    // Delete old photo
    if (profile.profilePhotoPublicId) {
      await deleteImage(profile.profilePhotoPublicId);
    }

    const result = await uploadImage(req.file.buffer, "players");

    profile.profilePhoto = result.secure_url;
    profile.profilePhotoPublicId = result.public_id;

    await profile.save();

    res.json({ message: "Profile photo updated", imageUrl: result.secure_url });

  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

exports.deleteProfilePhoto = async (req, res) => {
  const profile = await PlayerProfile.findOne({ user: req.user });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  await deleteImage(profile.profilePhotoPublicId);

  profile.profilePhoto = null;
  profile.profilePhotoPublicId = null;

  await profile.save();

  res.json({ message: "Profile photo deleted" });
};