const Tournament = require("../models/Tournament");
const TournamentStanding = require("../models/TournamentStanding");
const OrganizerProfile = require("../models/OrganizerProfile");

/* ────────────────────────────────
   1️⃣ ADD / UPDATE SQUAD STATS
──────────────────────────────── */

// exports.updateStanding = async (req, res) => {
//   try {
//     const { tournamentId, squadId, kills, placementPoints, wins } = req.body;

//     const tournament = await Tournament.findById(tournamentId);
//     if (!tournament)
//       return res.status(404).json({ message: "Tournament not found" });

//     // Only organizer of this tournament
//     const organizer = await OrganizerProfile.findOne({ owner: req.user });
//     if (!organizer || !tournament.organizerProfile.equals(organizer._id))
//       return res.status(403).json({ message: "Not your tournament" });

//     // Cannot update after results locked
//     if (tournament.lifecycleStatus === "RESULTS_FINALIZED")
//       return res.status(400).json({ message: "Standings locked" });

//     let standing = await TournamentStanding.findOne({
//       tournament: tournamentId,
//       squad: squadId
//     });

//     if (!standing) {
//       standing = await TournamentStanding.create({
//         tournament: tournamentId,
//         squad: squadId
//       });
//     }

//     standing.kills += kills || 0;
//     standing.placementPoints += placementPoints || 0;
//     standing.wins += wins || 0;

//     standing.totalPoints =
//       standing.kills + standing.placementPoints + (standing.wins * 10); // example scoring

//     await standing.save();

//     res.json({ message: "Standing updated", standing });

//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


/* ────────────────────────────────
   2️⃣ GET LEADERBOARD / STANDINGS
──────────────────────────────── */

exports.getStandings = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const standings = await TournamentStanding.find({ tournament: tournamentId })
      .populate("squad", "squadName logo")
      .sort({ totalPoints: -1, kills: -1 });

    // Add positions
    const ranked = standings.map((s, index) => ({
      position: index + 1,
      squad: s.squad,
      kills: s.kills,
      placementPoints: s.placementPoints,
      wins: s.wins,
      totalPoints: s.totalPoints
    }));

    res.json(ranked);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   3️⃣ FINALIZE RESULTS
──────────────────────────────── */

exports.finalizeResults = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer || !tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    tournament.lifecycleStatus = "RESULTS_FINALIZED";
    await tournament.save();

    res.json({ message: "Tournament results finalized" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
