const Squad = require("../models/Squad");
const { ensurePlayerNotInSquad } = require("../utils/squadValidation");
const SquadInvite = require("../models/SquadInvite");
const PlayerProfile = require("../models/PlayerProfile");
const JoinRequest = require("../models/JoinRequest");
const LeaveRequest = require("../models/LeaveRequest");
const { uploadImage } = require("../utils/uploadToCloudinary");
const { deleteImage } = require("../utils/deleteFromCloudinary");

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

exports.searchSquads = async (req, res) => {
  const { q } = req.query;
  const regex = new RegExp(q, "i");

  const squads = await Squad.find({
    squadName: regex,
    status: "ACTIVE"
  }).select("squadName game members");

  res.json(squads);
};

exports.sendJoinRequest = async (req, res) => {
  const { squadId } = req.body;

  try {
    await ensurePlayerNotInSquad(req.user);

    const existing = await JoinRequest.findOne({
      squad: squadId,
      player: req.user,
      status: "PENDING"
    });

    if (existing)
      return res.status(400).json({ message: "Request already sent" });

    const request = await JoinRequest.create({
      squad: squadId,
      player: req.user
    });

    res.status(201).json(request);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getSquadJoinRequests = async (req, res) => {
  const squad = await Squad.findOne({ "members.player": req.user });

  const me = squad.members.find(m => m.player.toString() === req.user);
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can view" });

  const requests = await JoinRequest.find({
    squad: squad._id,
    status: "PENDING"
  }).populate("player", "name username");

  res.json(requests);
};

exports.acceptJoinRequest = async (req, res) => {
  const request = await JoinRequest.findById(req.params.requestId).populate("squad");

  const squad = request.squad;
  const me = squad.members.find(m => m.player.toString() === req.user);
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can approve" });

  try {
    const profile = await ensurePlayerNotInSquad(request.player);

    const playstyleRole = profile.roles.find(r =>
      ["PRIMARY", "SECONDARY", "SNIPER", "NADER"].includes(r)
    ) || "PRIMARY";

    squad.members.push({
      player: request.player,
      isIGL: false,
      playstyleRole
    });

    profile.currentSquad = squad._id;
    request.status = "ACCEPTED";

    await squad.save();
    await profile.save();
    await request.save();

    res.json({ message: "Player added to squad" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.rejectJoinRequest = async (req, res) => {
  const { requestId } = req.params;

  const request = await JoinRequest.findById(requestId).populate("squad");

  if (!request || request.status !== "PENDING")
    return res.status(400).json({ message: "Invalid request" });

  // Check IGL permission
  const me = request.squad.members.find(m => m.player.toString() === req.user);
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can reject" });

  request.status = "REJECTED";
  await request.save();

  res.json({ message: "Join request rejected" });
};

exports.requestLeaveSquad = async (req, res) => {
  const profile = await PlayerProfile.findOne({ user: req.user });
  if (!profile.currentSquad)
    return res.status(400).json({ message: "Not in squad" });

  const squad = await Squad.findById(profile.currentSquad);

  const me = squad.members.find(m => m.player.toString() === req.user);
  const iglMember = squad.members.find(m => m.isIGL);

  // 🔥 CASE 1: Player is IGL trying to leave
  if (me.isIGL) {
    if (squad.members.length > 1) {
      return res.status(400).json({
        message: "Transfer IGL role before leaving"
      });
    }

    // IGL Only member → disband squad
    squad.status = "DISBANDED";
    squad.members = [];
    profile.previousSquads.push(squad.squadName);
    profile.currentSquad = null;

    await squad.save();
    await profile.save();

    return res.json({ message: "Squad disbanded" });
  }

  // 🔥 CASE 2: Normal player
  const iglProfile = await PlayerProfile.findOne({ user: iglMember.player });

  // If IGL inactive → leave directly
  if (iglProfile.playerStatus !== "ACTIVE") {
    squad.members = squad.members.filter(m => m.player.toString() !== req.user);
    profile.previousSquads.push(squad.squadName);
    profile.currentSquad = null;

    await squad.save();
    await profile.save();

    return res.json({ message: "Left squad (IGL inactive)" });
  }

  // Else send leave request
  const existing = await LeaveRequest.findOne({
    squad: squad._id,
    player: req.user,
    status: "PENDING"
  });

  if (existing)
    return res.status(400).json({ message: "Leave request already sent" });

  const request = await LeaveRequest.create({
    squad: squad._id,
    player: req.user
  });

  res.status(201).json(request);
};

exports.approveLeaveRequest = async (req, res) => {
  const request = await LeaveRequest.findById(req.params.requestId).populate("squad");

  const me = request.squad.members.find(m => m.player.toString() === req.user);
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can approve" });

  const profile = await PlayerProfile.findOne({ user: request.player });

  request.squad.members = request.squad.members.filter(
    m => m.player.toString() !== request.player.toString()
  );
  profile.previousSquads.push(request.squad.squadName);
  profile.currentSquad = null;
  request.status = "APPROVED";

  await request.squad.save();
  await profile.save();
  await request.save();

  res.json({ message: "Player removed from squad" });
};

exports.kickPlayer = async (req, res) => {
  const { playerId } = req.body;

  const squad = await Squad.findOne({ "members.player": req.user });
  const me = squad.members.find(m => m.player.toString() === req.user);
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can kick" });

  squad.members = squad.members.filter(m => m.player.toString() !== playerId);

  const profile = await PlayerProfile.findOne({ user: playerId });
  profile.previousSquads.push(squad.squadName);
  profile.currentSquad = null;

  await squad.save();
  await profile.save();

  res.json({ message: "Player kicked" });
};

exports.disbandSquad = async (req, res) => {
  const squad = await Squad.findOne({ "members.player": req.user });
  const me = squad.members.find(m => m.player.toString() === req.user);

  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can disband" });

  for (const member of squad.members) {
    const profile = await PlayerProfile.findOne({ user: member.player });
    profile.previousSquads.push(squad.squadName);
    profile.currentSquad = null;
    await profile.save();
  }

  squad.status = "DISBANDED";
  squad.members = [];
  await squad.save();

  res.json({ message: "Squad disbanded" });
};

exports.transferIGL = async (req, res) => {
  const { newIglId } = req.body;

  const squad = await Squad.findOne({ "members.player": req.user });
  if (!squad) return res.status(400).json({ message: "Not in squad" });

  const me = squad.members.find(m => m.player.toString() === req.user);
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can transfer leadership" });

  const newLeader = squad.members.find(m => m.player.toString() === newIglId);
  if (!newLeader)
    return res.status(400).json({ message: "Player not in squad" });

  me.isIGL = false;
  newLeader.isIGL = true;

  await squad.save();

  res.json({ message: "IGL transferred successfully" });
};

exports.uploadSquadLogo = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const squad = await Squad.findOne({ "members.player": req.user });
    if (!squad) return res.status(400).json({ message: "Not in squad" });

    const me = squad.members.find(m => m.player.toString() === req.user);
    if (!me.isIGL)
      return res.status(403).json({ message: "Only IGL can upload logo" });

    // Delete old logo if exists
    if (squad.logoPublicId) {
      await deleteImage(squad.logoPublicId);
    }

    const result = await uploadImage(req.file.buffer, "squads");

    squad.logo = result.secure_url;
    squad.logoPublicId = result.public_id;

    await squad.save();

    res.json({ message: "Squad logo updated", imageUrl: result.secure_url });

  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

exports.deleteSquadLogo = async (req, res) => {
  const squad = await Squad.findOne({ "members.player": req.user });
  if (!squad) return res.status(400).json({ message: "Not in squad" });

  const me = squad.members.find(m => m.player.toString() === req.user);
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can delete logo" });

  await deleteImage(squad.logoPublicId);

  squad.logo = null;
  squad.logoPublicId = null;

  await squad.save();

  res.json({ message: "Squad logo deleted" });
};
