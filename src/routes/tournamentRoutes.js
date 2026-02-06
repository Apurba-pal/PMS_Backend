const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { registerSquad, approveRegistration, rejectRegistration , approveAllRegistrations, disqualifySquad, getRegisteredSquads} = require("../controllers/tournamentRegistrationController");


const {
  requestOrganizerProfile,
  createTournament,
  getMyTournaments,
  openRegistration,
  closeRegistration,
} = require("../controllers/tournamentController");

/* ───────── ORGANIZER FLOW ───────── */

// Player requests to become organizer
router.post("/organizer/request", protect, requestOrganizerProfile);


/* ───────── TOURNAMENT FLOW ───────── */

// Create tournament (Organizer only)
router.post("/", protect, createTournament);

// View tournaments created by organizer
router.get("/mine", protect, getMyTournaments);

// Control registration
router.patch("/:tournamentId/open-registration", protect, openRegistration);
router.patch("/:tournamentId/close-registration", protect, closeRegistration);
router.post("/register", protect, registerSquad);
router.get("/:tournamentId/registrations", protect, getRegisteredSquads);
router.patch("/registration/:registrationId/approve", protect, approveRegistration);
router.patch("/:tournamentId/approve-all", protect, approveAllRegistrations);
router.patch("/registration/:registrationId/reject", protect, rejectRegistration);
router.patch("/registration/:registrationId/disqualify", protect, disqualifySquad);



module.exports = router;
