const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createSquad, sendInvite, acceptInvite, rejectInvite, getMyInvites , searchSquads, sendJoinRequest, getSquadJoinRequests, acceptJoinRequest, rejectJoinRequest} = require("../controllers/squadController");

router.post("/", protect, createSquad);
router.post("/invite", protect, sendInvite);
router.post("/invite/:inviteId/accept", protect, acceptInvite);
router.post("/invite/:inviteId/reject", protect, rejectInvite);
router.get("/invites/me", protect, getMyInvites);
router.get("/search", protect, searchSquads);
router.post("/join-request", protect, sendJoinRequest);
router.get("/join-requests", protect, getSquadJoinRequests);
router.post("/join-request/:requestId/accept", protect, acceptJoinRequest);
router.post("/join-request/:requestId/reject", protect, rejectJoinRequest);


module.exports = router;
