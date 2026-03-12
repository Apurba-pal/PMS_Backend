const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const {
  getAllVerificationRequests,
  getVerificationRequestById,
  reviewVerificationRequest,
  getAllPlayers,
  togglePlayerDisable
} = require("../controllers/adminController");

// Verification requests
router.get("/verifications", protect, adminOnly, getAllVerificationRequests);
router.get("/verifications/:id", protect, adminOnly, getVerificationRequestById);
router.patch("/verifications/:id", protect, adminOnly, reviewVerificationRequest);

// Player management
router.get("/players", protect, adminOnly, getAllPlayers);
router.patch("/players/:id/disable", protect, adminOnly, togglePlayerDisable);

module.exports = router;
