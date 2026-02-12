const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createSquad, sendInvite, acceptInvite, rejectInvite, getMyInvites , globalSearch, sendJoinRequest, getSquadJoinRequests, acceptJoinRequest, rejectJoinRequest, requestLeaveSquad, approveLeaveRequest, kickPlayer, disbandSquad, uploadSquadLogo, deleteSquadLogo, getMySquad, getSquadLeaveRequests, rejectLeaveRequest, transferIGL, getSquadSentInvites, cancelInvite, getMyJoinRequests, cancelJoinRequest} = require("../controllers/squadController");
const upload = require("../middleware/upload");

// get my squad
router.get("/me", protect, getMySquad);
// create squad
router.post("/", protect, createSquad);
// squad logo upload
router.post("/upload-logo", protect, upload.single("image"), uploadSquadLogo);
// igl invite player
router.post("/invite", protect, sendInvite);
// igl gets invites sent by his squad
router.get("/invites/sent", protect, getSquadSentInvites);
// igl cancels sent invites
router.post("/invite/:inviteId/cancel", protect, cancelInvite);
// player gets all the invite requests
router.get("/invites/me", protect, getMyInvites);
// player accept the request
router.post("/invite/:inviteId/accept", protect, acceptInvite);
// player rejects the request
router.post("/invite/:inviteId/reject", protect, rejectInvite);
// player searches squad 
router.get("/search", protect, globalSearch);
// player sends join request
router.post("/join-request", protect, sendJoinRequest);
// player says all the join request sent
router.get("/join-requests/me", protect, getMyJoinRequests);
// player calnels join request 
router.post("/join-request/:requestId/cancel", protect, cancelJoinRequest);
// igl gets all the join requests
router.get("/join-requests", protect, getSquadJoinRequests);
// igl accepts join request
router.post("/join-request/:requestId/accept", protect, acceptJoinRequest);
// igl rejects join request
router.post("/join-request/:requestId/reject", protect, rejectJoinRequest);
// player request to leave squad
router.post("/leave-request", protect, requestLeaveSquad);
// igl gets the squad leave request 
router.get("/leave-requests", protect, getSquadLeaveRequests);
// igl approves player request to leave squad
router.post("/leave-request/:requestId/approve", protect, approveLeaveRequest);
// igl rejects join request
router.post("/leave-request/:requestId/reject", protect, rejectLeaveRequest);
// igl transfers leadership to another member
router.post("/transfer-igl", protect, transferIGL);
// igl kicks away player
router.post("/kick", protect, kickPlayer);
// igl disband squad
router.post("/disband", protect, disbandSquad);
// delete quad logo
router.delete("/delete-logo", protect, deleteSquadLogo);


module.exports = router;
