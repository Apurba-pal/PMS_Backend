const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  createProfile,
  getMyProfile,
  updateProfile,
  searchPlayers
} = require("../controllers/playerController");

router.post("/", protect, createProfile);
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateProfile);
// router.patch("/me", protect, updateProfile);
// router.post("/me", protect, updateProfile);
router.get("/search", protect, searchPlayers);


module.exports = router;
