const OrganizerProfile = require("../models/OrganizerProfile");
const Tournament = require("../models/Tournament");
const TournamentStanding = require("../models/TournamentStanding");


/* ────────────────────────────────
   1️⃣ REQUEST ORGANIZER PROFILE
──────────────────────────────── */

exports.requestOrganizerProfile = async (req, res) => {
  try {
    const existing = await OrganizerProfile.findOne({ owner: req.user });

    if (existing)
      return res.status(400).json({ message: "Organizer profile already exists" });

    const { name, type, contactEmail, contactPhone, region, description } = req.body;

    const organizer = await OrganizerProfile.create({
      owner: req.user,
      name,
      type,
      contactEmail,
      contactPhone,
      region,
      description
    });

    res.status(201).json({
      message: "Organizer profile created. Awaiting admin verification.",
      organizer
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   2️⃣ CREATE TOURNAMENT
──────────────────────────────── */

exports.createTournament = async (req, res) => {
  try {
    const organizer = await OrganizerProfile.findOne({ owner: req.user });

    if (!organizer)
      return res.status(403).json({ message: "Organizer profile not found" });

    if (organizer.status !== "VERIFIED")
      return res.status(403).json({ message: "Organizer not verified" });

    const {
      name,
      game,
      eligibilityRules,
      registrationStart,
      registrationEnd,
      tournamentStart,
      tournamentEnd,
      externalCommsLink
    } = req.body;

    // 🧠 Date validations
    if (registrationStart && registrationEnd && new Date(registrationStart) > new Date(registrationEnd)) {
      return res.status(400).json({ message: "Invalid registration dates" });
    }

    if (tournamentStart && tournamentEnd && new Date(tournamentStart) > new Date(tournamentEnd)) {
      return res.status(400).json({ message: "Invalid tournament dates" });
    }

    // 🔥 Communication link validation
    if (externalCommsLink && !/^https?:\/\/.+\..+/.test(externalCommsLink))
      return res.status(400).json({ message: "Invalid communication link" });

    const tournament = await Tournament.create({
      name,
      game,
      organizerProfile: organizer._id,
      createdByUser: req.user,
      eligibilityRules,
      registrationStart,
      registrationEnd,
      tournamentStart,
      tournamentEnd,
      externalCommsLink
    });

    res.status(201).json(tournament);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   3️⃣ GET MY TOURNAMENTS
──────────────────────────────── */

exports.getMyTournaments = async (req, res) => {
  try {
    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer)
      return res.status(403).json({ message: "Organizer profile not found" });

    const tournaments = await Tournament.find({ organizerProfile: organizer._id })
      .sort({ createdAt: -1 });

    res.json(tournaments);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   4️⃣ OPEN REGISTRATION
──────────────────────────────── */

exports.openRegistration = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId);

    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer || !tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    // 🚫 Prevent reopening progressed tournaments
    if (["ONGOING", "COMPLETED", "RESULTS_FINALIZED", "CANCELLED"].includes(tournament.lifecycleStatus)) {
      return res.status(400).json({ message: "Tournament already progressed" });
    }

    if (tournament.lifecycleStatus !== "DRAFT")
      return res.status(400).json({ message: "Cannot open registration now" });

    tournament.lifecycleStatus = "REGISTRATION_OPEN";
    tournament.registrationControl = "OPEN";

    await tournament.save();

    res.json({ message: "Registration opened" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   5️⃣ CLOSE REGISTRATION
──────────────────────────────── */

exports.closeRegistration = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId);

    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer || !tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    if (tournament.lifecycleStatus !== "REGISTRATION_OPEN")
      return res.status(400).json({ message: "Registration not open" });

    tournament.lifecycleStatus = "REGISTRATION_CLOSED";
    tournament.registrationControl = "CLOSED";

    await tournament.save();

    res.json({ message: "Registration closed" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
