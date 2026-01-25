const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  createProfile,
  getMyProfile,
  updateProfile
} = require("../controllers/playerController");

router.post("/", protect, createProfile);
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateProfile);

module.exports = router;
