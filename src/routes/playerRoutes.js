const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const {
  createProfile,
  getMyProfile,
  updateProfile,
  searchPlayers,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadProfileQR
} = require("../controllers/playerController");

router.post("/", protect, createProfile);
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateProfile);
// router.patch("/me", protect, updateProfile);
// router.post("/me", protect, updateProfile);
router.get("/search", protect, searchPlayers);
router.post("/upload-photo", protect, upload.single("image"), uploadProfilePhoto);
router.delete("/delete-photo", protect, deleteProfilePhoto);
router.post("/upload-qr", protect, upload.single("image"), uploadProfileQR);


module.exports = router;
