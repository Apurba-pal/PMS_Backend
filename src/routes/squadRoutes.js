const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createSquad, sendInvite, acceptInvite, rejectInvite, getMyInvites , searchSquads, sendJoinRequest, getSquadJoinRequests, acceptJoinRequest, rejectJoinRequest, requestLeaveSquad, approveLeaveRequest, kickPlayer, disbandSquad, uploadSquadLogo, deleteSquadLogo} = require("../controllers/squadController");
const upload = require("../middleware/upload");

router.post("/", protect, createSquad);
// squad logo upload
router.post("/upload-logo", protect, upload.single("image"), uploadSquadLogo);
// igl invite player
router.post("/invite", protect, sendInvite);
// player gets all the invite requests
router.get("/invites/me", protect, getMyInvites);
// player accept the request
router.post("/invite/:inviteId/accept", protect, acceptInvite);
// player rejects the request
router.post("/invite/:inviteId/reject", protect, rejectInvite);
// player searches squad 
router.get("/search", protect, searchSquads);
// player sends join request
router.post("/join-request", protect, sendJoinRequest);
// igl gets all the join requests
router.get("/", protect, getSquadJoinRequests);
// igl accepts join request
router.post("/join-request/:requestId/accept", protect, acceptJoinRequest);
// igl rejects join request
router.post("/join-request/:requestId/reject", protect, rejectJoinRequest);
// player request to leave squad
router.post("/leave-request", protect, requestLeaveSquad);
// igl approves player request to leave squad
router.post("/leave-request/:requestId/approve", protect, approveLeaveRequest);
// igl kicks away player
router.post("/kick", protect, kickPlayer);
// igl disband squad
router.post("/disband", protect, disbandSquad);
// delete quad logo
router.delete("/delete-logo", protect, deleteSquadLogo);


module.exports = router;
