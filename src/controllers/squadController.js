const Squad = require("../models/Squad");
const { ensurePlayerNotInSquad } = require("../utils/squadValidation");
const SquadInvite = require("../models/SquadInvite");
const PlayerProfile = require("../models/PlayerProfile");
const JoinRequest = require("../models/JoinRequest");
const LeaveRequest = require("../models/LeaveRequest");
const { uploadImage } = require("../utils/uploadToCloudinary");
const { deleteImage } = require("../utils/deleteFromCloudinary");
const withTransaction = require("../utils/withTransaction");

exports.getMySquad = async (req, res) => {
  const squad = await Squad.findOne({ "members.player": req.user })
    .populate("members.player", "_id name username")
    .select("-__v");

  if (!squad)
    return res.status(404).json({ message: "Not in any squad" });

  res.json(squad);
};

exports.createSquad = async (req, res) => {
  const { squadName, game, playstyleRole } = req.body;

  try {
    if (!["PRIMARY", "SECONDARY", "SNIPER", "NADER"].includes(playstyleRole))
      throw new Error("Invalid playstyle role");

    await withTransaction(async (session) => {
      const profile = await PlayerProfile.findOne({ user: req.user }).session(session);
      if (!profile) throw new Error("Player profile not found");
      if (profile.currentSquad) throw new Error("Player already in a squad");

      const squadExists = await Squad.findOne({ squadName }).session(session);
      if (squadExists) throw new Error("Squad name taken");

      const squad = await Squad.create([{
        squadName,
        game,
        createdBy: req.user,
        members: [{
          player: req.user,
          isIGL: true,
          playstyleRole
        }]
      }], { session });

      profile.currentSquad = squad[0]._id;
      await profile.save({ session });
    });

    res.status(201).json({ message: "Squad created successfully" });

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
  if (squad.status !== "ACTIVE") return res.status(400).json({ message: "Squad not active" });

  const me = squad.members.find(m => m.player.toString() === req.user.toString());
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can invite" });

  if (squad.members.length >= squad.maxSize)
    return res.status(400).json({ message: "Squad is full" });

  // Check if player already in squad
  if (squad.members.some(m => m.player.toString() === playerId))
    return res.status(400).json({ message: "Player already in squad" });

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
  try {
    await withTransaction(async (session) => {
      const invite = await SquadInvite.findById(req.params.inviteId)
        .populate("squad")
        .session(session);

      if (!invite || invite.status !== "PENDING")
        throw new Error("Invalid invite");

      if (invite.player.toString() !== req.user.toString())
        throw new Error("Not your invite");


      const squad = invite.squad;
      if (squad.status !== "ACTIVE") throw new Error("Squad not active");

      // Squad full check
      if (squad.members.length >= squad.maxSize)
        throw new Error("Squad full");

      // Duplicate member check
      if (squad.members.some(m => m.player.toString() === req.user.toString()))
        throw new Error("Already in squad");

      const profile = await PlayerProfile.findOne({ user: req.user }).session(session);
      if (!profile) throw new Error("Player profile not found");

      if (profile.currentSquad)
        throw new Error("Player already in another squad");

      const playerRole = profile.roles.find(r =>
        ["PRIMARY", "SECONDARY", "SNIPER", "NADER"].includes(r)
      ) || "PRIMARY";

      squad.members.push({
        player: req.user,
        isIGL: false,
        playstyleRole: playerRole
      });

      profile.currentSquad = squad._id;
      invite.status = "ACCEPTED";

      await squad.save({ session });
      await profile.save({ session });
      await invite.save({ session });
    });

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

  if (invite.player.toString() !== req.user.toString())
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
  if (!squad) return res.status(400).json({ message: "Not in squad" });
  if (squad.status !== "ACTIVE") return res.status(400).json({ message: "Squad not active" });

  const me = squad.members.find(m => m.player.toString() === req.user.toString());
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can view" });

  const requests = await JoinRequest.find({
    squad: squad._id,
    status: "PENDING"
  }).populate("player", "name username");

  res.json(requests);
};

exports.acceptJoinRequest = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const request = await JoinRequest.findById(req.params.requestId)
        .populate("squad")
        .session(session);

      if (!request || request.status !== "PENDING")
        throw new Error("Invalid request");


      const squad = request.squad;
      if (squad.status !== "ACTIVE") throw new Error("Squad not active");

      const me = squad.members.find(m => m.player.toString() === req.user.toString());
      if (!me || !me.isIGL)
        throw new Error("Only IGL can approve");

      // Squad full check
      if (squad.members.length >= squad.maxSize)
        throw new Error("Squad full");

      // Duplicate member check
      if (squad.members.some(m => m.player.toString() === request.player.toString()))
        throw new Error("Player already in squad");

      const profile = await PlayerProfile.findOne({ user: request.player }).session(session);
      if (!profile) throw new Error("Player profile not found");

      if (profile.currentSquad)
        throw new Error("Player already in another squad");

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

      await squad.save({ session });
      await profile.save({ session });
      await request.save({ session });
    });

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
  const me = request.squad.members.find(m => m.player.toString() === req.user.toString());
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can reject" });

  request.status = "REJECTED";
  await request.save();

  res.json({ message: "Join request rejected" });
};

exports.requestLeaveSquad = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const profile = await PlayerProfile.findOne({ user: req.user }).session(session);
      if (!profile.currentSquad) throw new Error("Not in squad");

      const squad = await Squad.findById(profile.currentSquad).session(session);

      const me = squad.members.find(m => m.player.toString() === req.user.toString());
      const iglMember = squad.members.find(m => m.isIGL);

      // IGL leaving
      if (me.isIGL) {
        if (squad.members.length > 1)
          throw new Error("Transfer IGL role before leaving");

        squad.status = "DISBANDED";
        squad.members = [];
        profile.previousSquads.push(squad._id);
        profile.currentSquad = null;

        await squad.save({ session });
        await profile.save({ session });
        return;
      }

      const iglProfile = await PlayerProfile.findOne({ user: iglMember.player }).session(session);

      // IGL inactive → leave directly
      if (iglProfile.playerStatus !== "ACTIVE") {
        squad.members = squad.members.filter(m => m.player.toString() !== req.user.toString());
        profile.previousSquads.push(squad._id);
        profile.currentSquad = null;

        await squad.save({ session });
        await profile.save({ session });
        return;
      }

      const existing = await LeaveRequest.findOne({
        squad: squad._id,
        player: req.user,
        status: "PENDING"
      }).session(session);

      if (existing) throw new Error("Leave request already sent");

      await LeaveRequest.create([{ squad: squad._id, player: req.user }], { session });
    });

    res.json({ message: "Leave flow processed" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const request = await LeaveRequest.findById(req.params.requestId)
        .populate("squad")
        .session(session);

      const squad = request.squad;

      const me = squad.members.find(m => m.player.toString() === req.user.toString());
      if (!me || !me.isIGL) throw new Error("Only IGL can approve");

      const profile = await PlayerProfile.findOne({ user: request.player }).session(session);


      squad.members = squad.members.filter(m => m.player.toString() !== request.player.toString());

      // Auto-disband if squad is empty
      if (squad.members.length === 0) {
        squad.status = "DISBANDED";
      }

      profile.previousSquads.push(squad._id);
      profile.currentSquad = null;
      request.status = "APPROVED";

      await squad.save({ session });
      await profile.save({ session });
      await request.save({ session });
    });

    res.json({ message: "Player removed from squad" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.kickPlayer = async (req, res) => {
  const { playerId } = req.body;

  try {
    await withTransaction(async (session) => {

      const squad = await Squad.findOne({ "members.player": req.user }).session(session);
      if (!squad) throw new Error("Not in squad");
      if (squad.status !== "ACTIVE") throw new Error("Squad not active");

      const me = squad.members.find(m => m.player.toString() === req.user.toString());
      if (!me || !me.isIGL) throw new Error("Only IGL can kick");

      if (playerId === req.user.toString())
        throw new Error("IGL cannot kick themselves");

      if (!squad.members.some(m => m.player.toString() === playerId))
        throw new Error("Player not in squad");

      squad.members = squad.members.filter(m => m.player.toString() !== playerId);

      const profile = await PlayerProfile.findOne({ user: playerId }).session(session);
      profile.previousSquads.push(squad._id);
      profile.currentSquad = null;

      await squad.save({ session });
      await profile.save({ session });
    });

    res.json({ message: "Player kicked" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.disbandSquad = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const squad = await Squad.findOne({ "members.player": req.user }).session(session);
      if (!squad) throw new Error("Not in squad");

      const me = squad.members.find(m => m.player.toString() === req.user.toString());
      if (!me || !me.isIGL) throw new Error("Only IGL can disband");

      for (const member of squad.members) {
        const profile = await PlayerProfile.findOne({ user: member.player }).session(session);
        profile.previousSquads.push(squad._id);
        profile.currentSquad = null;
        await profile.save({ session });
      }

      squad.status = "DISBANDED";
      squad.members = [];
      await squad.save({ session });
    });

    res.json({ message: "Squad disbanded" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.transferIGL = async (req, res) => {
  const { newIglId } = req.body;


  await withTransaction(async (session) => {
    const squad = await Squad.findOne({ "members.player": req.user }).session(session);
    if (!squad) throw new Error("Not in squad");
    if (squad.status !== "ACTIVE") throw new Error("Squad not active");

    const me = squad.members.find(m => m.player.toString() === req.user.toString());
    if (!me || !me.isIGL)
      throw new Error("Only IGL can transfer leadership");

    const newLeader = squad.members.find(m => m.player.toString() === newIglId);
    if (!newLeader)
      throw new Error("Player not in squad");

    me.isIGL = false;
    newLeader.isIGL = true;

    await squad.save({ session });
  });

  res.json({ message: "IGL transferred successfully" });
};

exports.uploadSquadLogo = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });


  try {
    const squad = await Squad.findOne({ "members.player": req.user });
    if (!squad) return res.status(400).json({ message: "Not in squad" });
    if (squad.status !== "ACTIVE") return res.status(400).json({ message: "Squad not active" });

    const me = squad.members.find(m => m.player.toString() === req.user.toString());
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
  if (squad.status !== "ACTIVE") return res.status(400).json({ message: "Squad not active" });

  const me = squad.members.find(m => m.player.toString() === req.user.toString());
  if (!me.isIGL)
    return res.status(403).json({ message: "Only IGL can delete logo" });

  await deleteImage(squad.logoPublicId);

  squad.logo = null;
  squad.logoPublicId = null;

  await squad.save();

  res.json({ message: "Squad logo deleted" });
};
