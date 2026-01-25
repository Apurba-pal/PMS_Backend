const Squad = require("../models/Squad");
const { ensurePlayerNotInSquad } = require("../utils/squadValidation");
const SquadInvite = require("../models/SquadInvite");
const PlayerProfile = require("../models/PlayerProfile");

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

exports.sendInvite = async (req, res) => {
  const { playerId } = req.body;

  if (!playerId)
    return res.status(400).json({ message: "playerId is required" });

  const squad = await Squad.findOne({ "members.player": req.user });
  if (!squad) return res.status(400).json({ message: "Not in squad" });

  const me = squad.members.find(m => m.player.toString() === req.user);
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can invite" });

  if (squad.members.length >= squad.maxSize)
    return res.status(400).json({ message: "Squad is full" });

  try {
    await ensurePlayerNotInSquad(playerId);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const existingInvite = await SquadInvite.findOne({
    squad: squad._id,
    player: playerId,
    status: "PENDING"
  });

  if (existingInvite)
    return res.status(400).json({ message: "Invite already sent" });

  const invite = await SquadInvite.create({
    squad: squad._id,
    player: playerId
  });

  res.status(201).json(invite);
};


exports.acceptInvite = async (req, res) => {
  const invite = await SquadInvite.findById(req.params.inviteId).populate("squad");

  if (!invite || invite.status !== "PENDING")
    return res.status(400).json({ message: "Invalid invite" });

  if (invite.player.toString() !== req.user)
    return res.status(403).json({ message: "Not your invite" });

  try {
    const profile = await ensurePlayerNotInSquad(req.user);

    // Auto assign primary playstyle role
    const playerRole = profile.roles.find(r =>
      ["PRIMARY", "SECONDARY", "SNIPER", "NADER"].includes(r)
    );

    invite.status = "ACCEPTED";

    invite.squad.members.push({
      player: req.user,
      isIGL: false,
      playstyleRole: playerRole || "PRIMARY"
    });

    profile.currentSquad = invite.squad._id;

    await invite.squad.save();
    await profile.save();
    await invite.save();

    res.json({ message: "Joined squad successfully" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.rejectInvite = async (req, res) => {
  const { inviteId } = req.params;

  const invite = await SquadInvite.findById(inviteId);

  if (!invite || invite.status !== "PENDING")
    return res.status(400).json({ message: "Invalid invite" });

  if (invite.player.toString() !== req.user)
    return res.status(403).json({ message: "Not your invite" });

  invite.status = "REJECTED";
  await invite.save();

  res.json({ message: "Invite rejected" });
};

exports.getMyInvites = async (req, res) => {
  const invites = await SquadInvite.find({
    player: req.user,
    status: "PENDING"
  })
    .populate("squad", "squadName game status")
    .populate("player", "name username");

  res.json(invites);
};
