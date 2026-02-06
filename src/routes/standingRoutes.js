const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  updateStanding,
  getStandings,
  finalizeResults
} = require("../controllers/standingController");

// router.post("/update", protect, updateStanding);
router.get("/:tournamentId", protect, getStandings);
router.patch("/:tournamentId/finalize", protect, finalizeResults);

module.exports = router;
