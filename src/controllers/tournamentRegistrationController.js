const Tournament = require("../models/Tournament");
const TournamentRegistration = require("../models/TournamentRegistration");
const Squad = require("../models/Squad");
const OrganizerProfile = require("../models/OrganizerProfile");

/* ────────────────────────────────
   1️⃣ REGISTER SQUAD TO TOURNAMENT
──────────────────────────────── */

exports.registerSquad = async (req, res) => {
  try {
    const { tournamentId, players } = req.body;

    if (!players || !players.length)
      return res.status(400).json({ message: "Roster players required" });

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    if (tournament.lifecycleStatus !== "REGISTRATION_OPEN")
      return res.status(400).json({ message: "Registration not open" });

    const squad = await Squad.findOne({ "members.player": req.user });
    if (!squad)
      return res.status(400).json({ message: "You are not in a squad" });

    const me = squad.members.find(m => m.player.toString() === req.user);
    if (!me.isIGL)
      return res.status(403).json({ message: "Only IGL can register squad" });

    if (squad.status !== "ACTIVE")
      return res.status(400).json({ message: "Squad not active" });

    // 🔥 Organizer cannot compete
    const organizerProfile = await OrganizerProfile.findById(tournament.organizerProfile);
    if (!organizerProfile)
      return res.status(500).json({ message: "Organizer profile missing" });

    if (organizerProfile.owner.toString() === req.user.toString())
      return res.status(400).json({ message: "Organizer cannot compete in own tournament" });

    // ❌ Duplicate squad registration
    const existingSquadReg = await TournamentRegistration.findOne({
      tournament: tournamentId,
      squad: squad._id
    });
    if (existingSquadReg)
      return res.status(400).json({ message: "Squad already registered" });

    const squadPlayerIds = squad.members.map(m => m.player.toString());
    const allowedRoles = ["PRIMARY", "SECONDARY", "SNIPER", "NADER"];

    // ❌ Duplicate players inside roster
    const ids = players.map(p => p.playerId);
    if (new Set(ids).size !== ids.length)
      return res.status(400).json({ message: "Duplicate players in roster" });

    for (const p of players) {
      if (!squadPlayerIds.includes(p.playerId))
        return res.status(400).json({ message: "Player not in squad" });

      if (!allowedRoles.includes(p.playstyleRole))
        return res.status(400).json({ message: "Invalid playstyle role" });
    }

    // 🚨 PLAYER CONFLICT CHECK (MOST IMPORTANT)
    const conflict = await TournamentRegistration.findOne({
      tournament: tournamentId,
      "roster.player": { $in: players.map(p => p.playerId) },
      registrationStatus: { $in: ["REQUESTED", "APPROVED"] }
    });

    if (conflict)
      return res.status(400).json({
        message: "One or more players already registered with another squad"
      });

    // Eligibility
    if (
      players.length < tournament.eligibilityRules.minSquadSize ||
      players.length > tournament.eligibilityRules.maxSquadSize
    )
      return res.status(400).json({ message: "Roster size not eligible" });

    const roster = players.map(p => ({
      player: p.playerId,
      playstyleRole: p.playstyleRole
    }));

    const registration = await TournamentRegistration.create({
      tournament: tournamentId,
      squad: squad._id,
      roster,
      isRosterLocked: true
    });

    res.status(201).json({
      message: "Registration submitted. Roster locked.",
      registration
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ────────────────────────────────
   VIEW REGISTERED SQUADS (FULL DETAILS)
──────────────────────────────── */

exports.getRegisteredSquads = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer || !tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    const registrations = await TournamentRegistration.find({
      tournament: tournamentId
    })
      .populate({
        path: "squad",
        select: "squadName logo members",
        populate: {
          path: "members.player",
          model: "User",
          select: "name username email"
        }
      })
      .populate({
        path: "roster.player",
        model: "User",
        select: "name username email"
      });

    res.json(registrations);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   2️⃣ APPROVE SQUAD REGISTRATION
──────────────────────────────── */

exports.approveRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration =
      await TournamentRegistration.findById(registrationId).populate(
        "tournament",
      );

    if (!registration)
      return res.status(404).json({ message: "Registration not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });

    if (
      !organizer ||
      !registration.tournament.organizerProfile.equals(organizer._id)
    )
      return res.status(403).json({ message: "Not your tournament" });

    if (
      ["ONGOING", "COMPLETED", "RESULTS_FINALIZED", "CANCELLED"].includes(
        registration.tournament.lifecycleStatus,
      )
    )
      return res
        .status(400)
        .json({ message: "Cannot modify registrations now" });

    if (registration.registrationStatus !== "REQUESTED")
      return res.status(400).json({ message: "Invalid state" });

    registration.registrationStatus = "APPROVED";

    await registration.save();

    res.json({ message: "Squad approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ────────────────────────────────
   4️⃣ APPROVE ALL REGISTRATIONS
──────────────────────────────── */

exports.approveAllRegistrations = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer || !tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    if (
      ["ONGOING", "COMPLETED", "RESULTS_FINALIZED", "CANCELLED"].includes(
        tournament.lifecycleStatus,
      )
    )
      return res.status(400).json({ message: "Tournament already progressed" });

      if (!["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(tournament.lifecycleStatus))
  return res.status(400).json({ message: "Cannot approve at this stage" });


    const result = await TournamentRegistration.updateMany(
      {
        tournament: tournamentId,
        registrationStatus: "REQUESTED",
      },
      { $set: { registrationStatus: "APPROVED" } },
    );

    res.json({
      message: "All pending squads approved",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ────────────────────────────────
   3️⃣ REJECT SQUAD REGISTRATION
──────────────────────────────── */

exports.rejectRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    // 1️⃣ Fetch registration first
    const registration = await TournamentRegistration.findById(registrationId);
    if (!registration)
      return res.status(404).json({ message: "Registration not found" });

    // 2️⃣ Now populate tournament safely
    await registration.populate("tournament");

    // 3️⃣ Organizer permission check
    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (
      !organizer ||
      !registration.tournament.organizerProfile.equals(organizer._id)
    )
      return res.status(403).json({ message: "Not your tournament" });

    // 4️⃣ Block late changes (important)
    if (
      ["ONGOING", "COMPLETED", "RESULTS_FINALIZED", "CANCELLED"].includes(
        registration.tournament.lifecycleStatus,
      )
    )
      return res
        .status(400)
        .json({ message: "Cannot modify registrations now" });

    // 5️⃣ Only fresh requests can be rejected
    if (registration.registrationStatus !== "REQUESTED")
      return res.status(400).json({ message: "Invalid state" });

    // 6️⃣ Reject
    registration.registrationStatus = "REJECTED";
    await registration.save();

    res.json({ message: "Squad rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ────────────────────────────────
   🚫 DISQUALIFY SQUAD
──────────────────────────────── */

exports.disqualifySquad = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { reason, proofUrl } = req.body;

    if (!reason)
      return res.status(400).json({ message: "Disqualification reason required" });

    const registration = await TournamentRegistration.findById(registrationId)
      .populate("tournament");

    if (!registration)
      return res.status(404).json({ message: "Registration not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });

    if (!organizer || !registration.tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    // ❌ Must be approved first
    if (registration.registrationStatus !== "APPROVED")
      return res.status(400).json({ message: "Only approved squads can be disqualified" });

    // ❌ Tournament must be running or done
    if (!["ONGOING", "COMPLETED"].includes(registration.tournament.lifecycleStatus))
      return res.status(400).json({ message: "Cannot disqualify at this stage" });

    // ❌ Already disqualified
    if (registration.disqualification?.disqualifiedAt)
      return res.status(400).json({ message: "Squad already disqualified" });

    registration.registrationStatus = "DISQUALIFIED";

    registration.disqualification = {
      reason,
      proofUrl,
      disqualifiedBy: req.user,
      disqualifiedAt: new Date()
    };

    await registration.save();

    res.json({ message: "Squad disqualified successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
