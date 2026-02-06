const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");

dotenv.config();

const app = express();

// route imports
const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const squadRoutes = require("./routes/squadRoutes")
const tournamentRoutes = require("./routes/tournamentRoutes");
const standingsRoutes = require("./routes/standingRoutes");


// middleware
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/squads", squadRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/standings", standingsRoutes);

module.exports = app;
