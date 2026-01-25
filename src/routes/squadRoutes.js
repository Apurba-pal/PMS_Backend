const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createSquad, sendInvite, acceptInvite, rejectInvite, getMyInvites } = require("../controllers/squadController");

router.post("/", protect, createSquad);
router.post("/invite", protect, sendInvite);
router.post("/invite/:inviteId/accept", protect, acceptInvite);
router.post("/invite/:inviteId/reject", protect, rejectInvite);
router.get("/invites/me", protect, getMyInvites);

module.exports = router;
