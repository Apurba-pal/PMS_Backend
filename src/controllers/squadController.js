const Squad = require("../models/Squad");
const { ensurePlayerNotInSquad } = require("../utils/squadValidation");

exports.createSquad = async (req, res) => {
  const { squadName, game, playstyleRole } = req.body;

  try {
    const userProfile = await ensurePlayerNotInSquad(req.user);

    const squadExists = await Squad.findOne({ squadName });
    if (squadExists)
      return res.status(400).json({ message: "Squad name taken" });

    const squad = await Squad.create({
      squadName,
      game,
      createdBy: req.user,
      members: [{
        player: req.user,
        isIGL: true,
        playstyleRole
      }]
    });

    userProfile.currentSquad = squad._id;
    await userProfile.save();

    res.status(201).json(squad);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
