const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// route imports
const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use("/api/auth", authRoutes);
app.use("/api/player", playerRoutes);

module.exports = app;
