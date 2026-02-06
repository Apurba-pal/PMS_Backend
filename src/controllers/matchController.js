const TournamentMatch = require("../models/TournamentMatch");
const TournamentStanding = require("../models/TournamentStanding");
const Tournament = require("../models/Tournament");
const OrganizerProfile = require("../models/OrganizerProfile");

/* ────────────────────────────────
   1️⃣ CREATE MATCH ROOM
──────────────────────────────── */

exports.createMatch = async (req, res) => {
  try {
    const { tournamentId, matchNumber, mapName, roomId, roomPassword } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    const organizer = await OrganizerProfile.findOne({ owner: req.user });

    if (!organizer || !tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    const match = await TournamentMatch.create({
      tournament: tournamentId,
      matchNumber,
      mapName,
      roomId,
      roomPassword
    });

    res.status(201).json(match);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   2️⃣ SUBMIT MATCH RESULTS
──────────────────────────────── */

exports.submitMatchResults = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { results } = req.body;

    const match = await TournamentMatch.findById(matchId).populate("tournament");

    if (!match)
      return res.status(404).json({ message: "Match not found" });

    const organizer = await OrganizerProfile.findOne({ owner: req.user });
    if (!organizer || !match.tournament.organizerProfile.equals(organizer._id))
      return res.status(403).json({ message: "Not your tournament" });

    if (match.tournament.lifecycleStatus === "RESULTS_FINALIZED") {
      return res.status(400).json({ message: "Results already finalized" });
    }

    if (match.status === "COMPLETED")
      return res.status(400).json({ message: "Match already finalized" });

    match.results = results;
    match.status = "COMPLETED";
    await match.save();

    // 🔥 AUTO UPDATE STANDINGS
    for (const r of results) {
      let standing = await TournamentStanding.findOne({
        tournament: match.tournament._id,
        squad: r.squad
      });

      if (!standing) {
        standing = await TournamentStanding.create({
          tournament: match.tournament._id,
          squad: r.squad
        });
      }

      const placementPoints = getPlacementPoints(r.placement);

      standing.kills += r.kills;
      standing.placementPoints += placementPoints;
      if (r.placement === 1) standing.wins += 1;

      standing.totalPoints = standing.kills + standing.placementPoints + (standing.wins * 10);

      await standing.save();
    }

    res.json({ message: "Match results submitted and standings updated" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ────────────────────────────────
   🎯 Placement Scoring Logic
──────────────────────────────── */

function getPlacementPoints(place) {
//   const table = {
//     1: 12,
//     2: 9,
//     3: 8,
//     4: 7,
//     5: 6,
//     6: 5,
//     7: 4,
//     8: 3,
//     9: 2,
//     10: 1,
//     11: 0,
//     12: 0
//   };
//   return table[place] || 0;

  const table = [12,9,8,7,6,5,4,3,2,1,0,0];
  return table[place-1] || 0;
}
