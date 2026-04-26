const TournamentMatch = require("../models/TournamentMatch");
const TournamentStanding = require("../models/TournamentStanding");
const Tournament = require("../models/Tournament");
const OrganizerProfile = require("../models/OrganizerProfile");
const withTransaction = require("../utils/withTransaction");

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

    await withTransaction(async (session) => {
      const match = await TournamentMatch.findById(matchId)
        .populate("tournament")
        .session(session);

      if (!match)
        throw Object.assign(new Error("Match not found"), { status: 404 });

      const organizer = await OrganizerProfile.findOne({ owner: req.user }).session(session);
      if (!organizer || !match.tournament.organizerProfile.equals(organizer._id))
        throw Object.assign(new Error("Not your tournament"), { status: 403 });

      if (match.tournament.lifecycleStatus === "RESULTS_FINALIZED")
        throw Object.assign(new Error("Results already finalized"), { status: 400 });

      if (match.status === "COMPLETED")
        throw Object.assign(new Error("Match already finalized"), { status: 400 });

      match.results = results;
      match.status = "COMPLETED";
      await match.save({ session });

      // 🔥 AUTO UPDATE STANDINGS
      for (const r of results) {
        let standing = await TournamentStanding.findOne({
          tournament: match.tournament._id,
          squad: r.squad
        }).session(session);

        if (!standing) {
          [standing] = await TournamentStanding.create(
            [{ tournament: match.tournament._id, squad: r.squad }],
            { session }
          );
        }

        const placementPoints = getPlacementPoints(r.placement);

        standing.kills += r.kills;
        standing.placementPoints += placementPoints;
        if (r.placement === 1) standing.wins += 1;
        standing.totalPoints = standing.kills + standing.placementPoints + (standing.wins * 10);

        await standing.save({ session });
      }
    });

    res.json({ message: "Match results submitted and standings updated" });

  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
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
