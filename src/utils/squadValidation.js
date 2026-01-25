const PlayerProfile = require("../models/PlayerProfile");

exports.ensurePlayerNotInSquad = async (userId) => {
  const profile = await PlayerProfile.findOne({ user: userId });

  if (!profile) throw new Error("Player profile not found");

  if (profile.currentSquad)
    throw new Error("Player already in another squad");

  return profile;
};
