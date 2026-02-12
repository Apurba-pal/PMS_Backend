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

  // ❗ NEW: block if player already sent join request
  const existingJoinRequest = await JoinRequest.findOne({
    squad: squad._id,
    player: playerId,
    status: "PENDING"
  });

    if (existingJoinRequest)
    return res.status(400).json({
      message: "Player already requested to join"
    });

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

exports.getSquadSentInvites = async (req, res) => {
  const squad = await Squad.findOne({ "members.player": req.user });
  if (!squad) return res.status(400).json({ message: "Not in squad" });
  if (squad.status !== "ACTIVE")
    return res.status(400).json({ message: "Squad not active" });

  const me = squad.members.find(
    m => m.player.toString() === req.user.toString()
  );
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can view sent invites" });

  const invites = await SquadInvite.find({
    squad: squad._id,
    status: "PENDING"
  }).populate("player", "name username");

  res.json(invites);
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
    
      if (squad.members.length >= squad.maxSize) {
        // Expire other pending invites
        await SquadInvite.updateMany(
          {
            squad: squad._id,
            status: "PENDING",
            _id: { $ne: invite._id }
          },
          { status: "EXPIRED" },
          { session }
        );

        // Reject pending join requests
        await JoinRequest.updateMany(
          {
            squad: squad._id,
            status: "PENDING"
          },
          { status: "REJECTED" },
          { session }
        );
      }
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

exports.cancelInvite = async (req, res) => {
  const { inviteId } = req.params;

  const squad = await Squad.findOne({ "members.player": req.user });
  if (!squad)
    return res.status(400).json({ message: "Not in squad" });

  if (squad.status !== "ACTIVE")
    return res.status(400).json({ message: "Squad not active" });

  const me = squad.members.find(
    m => m.player.toString() === req.user.toString()
  );
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can cancel invites" });

  const invite = await SquadInvite.findById(inviteId);

  if (!invite)
    return res.status(404).json({ message: "Invite not found" });

  if (invite.squad.toString() !== squad._id.toString())
    return res.status(403).json({ message: "Invite does not belong to your squad" });

  if (invite.status !== "PENDING")
    return res.status(400).json({ message: "Invite cannot be cancelled" });

  invite.status = "CANCELLED";
  await invite.save();

  res.json({ message: "Invite cancelled successfully" });
};

exports.globalSearch = async (req, res) => {
  try {
    const { q = "", type = "all" } = req.query;

    if (!q.trim()) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const regex = new RegExp(q, "i");
    const results = {};

    /* ======================
       SEARCH SQUADS
    ====================== */
    if (type === "squad" || type === "all") {
      results.squads = await Squad.find({
        squadName: regex,
        status: "ACTIVE"
      })
        .select("squadName game members logo")
        .populate("members.player", "username name");
    }

    /* ======================
       SEARCH PLAYERS
    ====================== */
    if (type === "player" || type === "all") {
      results.players = await PlayerProfile.find({
        $or: [
          { username: regex },
          { inGameName: regex }
        ],
        playerStatus: "ACTIVE"
      })
        .select("user username inGameName roles achievements")
        .populate("user", "name");
    }

    res.json(results);

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};

exports.sendJoinRequest = async (req, res) => {
  const { squadId } = req.body;

  try {
    await ensurePlayerNotInSquad(req.user);

    const squad = await Squad.findById(squadId);
    if (!squad) throw new Error("Squad not found");
    if (squad.status !== "ACTIVE") throw new Error("Squad not active");

    if (squad.members.length >= squad.maxSize)
      throw new Error("Squad is full");

    const existing = await JoinRequest.findOne({
      squad: squadId,
      player: req.user,
      status: "PENDING"
    });

    if (existing)
      return res.status(400).json({ message: "Request already sent" });

    // ❗ NEW: block if squad already invited player
    const existingInvite = await SquadInvite.findOne({
      squad: squadId,
      player: req.user,
      status: "PENDING"
    });

    if (existingInvite)
      throw new Error("You already have an invite from this squad");

    const request = await JoinRequest.create({
      squad: squadId,
      player: req.user
    });

    res.status(201).json(request);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getMyJoinRequests = async (req, res) => {
  const requests = await JoinRequest.find({
    player: req.user
  })
    .populate("squad", "squadName game status")
    .sort({ createdAt: -1 });

  res.json(requests);
};

exports.cancelJoinRequest = async (req, res) => {
  const { requestId } = req.params;

  const request = await JoinRequest.findById(requestId);

  if (!request || request.status !== "PENDING")
    return res.status(400).json({ message: "Invalid request" });

  if (request.player.toString() !== req.user.toString())
    return res.status(403).json({ message: "Not your request" });

  request.status = "CANCELLED";
  await request.save();

  res.json({ message: "Join request cancelled" });
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
      
            // ❗ NEW: cleanup if squad full after accept
      if (squad.members.length >= squad.maxSize) {

        await SquadInvite.updateMany(
          {
            squad: squad._id,
            status: "PENDING"
          },
          { status: "EXPIRED" },
          { session }
        );

        await JoinRequest.updateMany(
          {
            squad: squad._id,
            status: "PENDING",
            _id: { $ne: request._id }
          },
          { status: "REJECTED" },
          { session }
        );
      }
    });

    res.json({ message: "Player added to squad" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.rejectJoinRequest = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const request = await JoinRequest.findById(req.params.requestId)
        .populate("squad")
        .session(session);

      if (!request || request.status !== "PENDING")
        throw new Error("Invalid request");

      const squad = request.squad;

      if (squad.status !== "ACTIVE")
        throw new Error("Squad not active");

      const me = squad.members.find(
        m => m.player.toString() === req.user.toString()
      );

      if (!me || !me.isIGL)
        throw new Error("Only IGL can reject");

      request.status = "REJECTED";
      await request.save({ session });
    });

    res.json({ message: "Join request rejected" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
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

exports.getSquadLeaveRequests = async (req, res) => {
  const squad = await Squad.findOne({ "members.player": req.user });
  if (!squad) return res.status(400).json({ message: "Not in squad" });
  if (squad.status !== "ACTIVE")
    return res.status(400).json({ message: "Squad not active" });

  const me = squad.members.find(
    m => m.player.toString() === req.user.toString()
  );
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can view leave requests" });

  const requests = await LeaveRequest.find({
    squad: squad._id,
    status: "PENDING"
  }).populate("player", "name username");

  res.json(requests);
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

exports.rejectLeaveRequest = async (req, res) => {
  const request = await LeaveRequest.findById(req.params.requestId)
    .populate("squad");

  if (!request || request.status !== "PENDING")
    return res.status(400).json({ message: "Invalid leave request" });

  const squad = request.squad;

  const me = squad.members.find(
    m => m.player.toString() === req.user.toString()
  );
  if (!me || !me.isIGL)
    return res.status(403).json({ message: "Only IGL can reject leave request" });

  request.status = "REJECTED";
  await request.save();

  res.json({ message: "Leave request rejected" });
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

      if (squad.status !== "ACTIVE")
        throw new Error("Squad not active");

      const me = squad.members.find(
        m => m.player.toString() === req.user.toString()
      );

      if (!me || !me.isIGL)
        throw new Error("Only IGL can disband");

      // 🔹 Update all member profiles
      for (const member of squad.members) {
        const profile = await PlayerProfile.findOne({ user: member.player }).session(session);
        if (profile) {
          profile.previousSquads.push(squad._id);
          profile.currentSquad = null;
          await profile.save({ session });
        }
      }

      // 🔹 Cleanup all pending data
      await SquadInvite.updateMany(
        { squad: squad._id, status: "PENDING" },
        { status: "EXPIRED" },
        { session }
      );

      await JoinRequest.updateMany(
        { squad: squad._id, status: "PENDING" },
        { status: "REJECTED" },
        { session }
      );

      await LeaveRequest.updateMany(
        { squad: squad._id, status: "PENDING" },
        { status: "REJECTED" },
        { session }
      );

      squad.status = "DISBANDED";
      squad.members = [];
      await squad.save({ session });
    });

    res.json({ message: "Squad disbanded successfully" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.transferIGL = async (req, res) => {
  try {
    const { newIglId } = req.body;

    if (!newIglId)
      return res.status(400).json({ message: "newIglId is required" });

    await withTransaction(async (session) => {
      const squad = await Squad.findOne({ "members.player": req.user }).session(session);
      if (!squad) throw new Error("Not in squad");
      if (squad.status !== "ACTIVE") throw new Error("Squad not active");

      const me = squad.members.find(
        m => m.player.toString() === req.user.toString()
      );

      if (!me || !me.isIGL)
        throw new Error("Only IGL can transfer leadership");

      if (req.user.toString() === newIglId.toString())
        throw new Error("Cannot transfer leadership to yourself");

      const newLeader = squad.members.find(
        m => m.player.toString() === newIglId.toString()
      );

      if (!newLeader)
        throw new Error("Player not in squad");

      if (newLeader.isIGL)
        throw new Error("Player is already IGL");

      me.isIGL = false;
      newLeader.isIGL = true;

      await squad.save({ session });
    });

    res.json({ message: "IGL transferred successfully" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
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
