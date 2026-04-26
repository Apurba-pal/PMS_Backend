const PlayerProfile = require("../models/PlayerProfile");
const VerificationRequest = require("../models/VerificationRequest");
const User = require("../models/User");
const { uploadImage } = require("../utils/uploadToCloudinary");
const { deleteImage } = require("../utils/deleteFromCloudinary");
const resetVerificationIfNeeded = require("../utils/resetVerificationIfNeeded");
const withTransaction = require("../utils/withTransaction");

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
  const profile = await PlayerProfile.findOne({ user: req.user }).populate("user", "name email username phone dob")
  .populate("currentSquad", "squadName logo status game")
  .populate("previousSquads", "squadName");

  if (!profile) return res.status(404).json({ message: "Profile not found" });

  res.json(profile);
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await PlayerProfile.findOne({ user: req.user });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const oldUID = profile.gameUID;

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

    const uidChanged =
      req.body.gameUID &&
      oldUID &&
      req.body.gameUID !== oldUID;

    if (uidChanged) {
      // Wrap profile save + verification reset in a transaction
      await withTransaction(async (session) => {
        await profile.save({ session });
        await resetVerificationIfNeeded(req.user, session);
      });
    } else {
      await profile.save();
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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

exports.uploadProfileQR = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "No QR image uploaded" });

  try {
    const profile = await PlayerProfile.findOne({ user: req.user });
    if (!profile)
      return res.status(404).json({ message: "Profile not found" });

    /**
     * NOTE (important, future):
     * If player is VERIFIED and uploads a new QR,
     * this is where verification reset / re-review logic will go.
     */

    // If QR already exists, delete old one
    if (profile.profileQRPublicId) {
      await deleteImage(profile.profileQRPublicId);
    }

    // Cloudinary upload happens outside transaction (external side-effect)
    const result = await uploadImage(req.file.buffer, "player-qr");

    // DB writes + verification reset are atomic
    await withTransaction(async (session) => {
      const freshProfile = await PlayerProfile.findOne({ user: req.user }).session(session);

      freshProfile.profileQR = result.secure_url;
      freshProfile.profileQRPublicId = result.public_id;
      await freshProfile.save({ session });

      await resetVerificationIfNeeded(req.user, session);
    });

    res.json({
      message: "Profile QR uploaded successfully",
      qrUrl: result.secure_url
    });

  } catch (err) {
    res.status(500).json({
      message: "QR upload failed",
      error: err.message
    });
  }
};

exports.submitVerificationRequest = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "No ID proof image uploaded" });

  try {
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (["PENDING_REVIEW", "VERIFIED"].includes(user.accountStatus)) {
      return res.status(400).json({
        message:
          user.accountStatus === "VERIFIED"
            ? "Your account is already verified"
            : "A verification request is already pending review"
      });
    }

    // Check if an old rejected request exists (for re-submission)
    const existing = await VerificationRequest.findOne({ player: req.user });

    // Delete old ID proof from Cloudinary if re-submitting (outside transaction — external side-effect)
    if (existing && existing.idProofPublicId) {
      await deleteImage(existing.idProofPublicId);
    }

    // Cloudinary upload happens outside transaction (external side-effect)
    const result = await uploadImage(req.file.buffer, "id-proofs");

    // DB writes are atomic
    await withTransaction(async (session) => {
      const freshUser = await User.findById(req.user).session(session);

      if (existing) {
        existing.idProofUrl = result.secure_url;
        existing.idProofPublicId = result.public_id;
        existing.status = "PENDING";
        existing.adminNote = "";
        await existing.save({ session });
      } else {
        await VerificationRequest.create(
          [{ player: req.user, idProofUrl: result.secure_url, idProofPublicId: result.public_id }],
          { session }
        );
      }

      freshUser.accountStatus = "PENDING_REVIEW";
      await freshUser.save({ session });
    });

    res.json({
      message: "Verification request submitted successfully",
      accountStatus: "PENDING_REVIEW"
    });

  } catch (err) {
    res.status(500).json({ message: "Submission failed", error: err.message });
  }
};