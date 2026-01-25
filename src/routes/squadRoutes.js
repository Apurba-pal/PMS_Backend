const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createSquad } = require("../controllers/squadController");

router.post("/", protect, createSquad);

module.exports = router;
