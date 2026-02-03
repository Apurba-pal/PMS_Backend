const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("role accountStatus");
    if (!user) return res.status(401).json({ message: "User not found" });

    if (user.accountStatus === "DISABLED")
      return res.status(403).json({ message: "Account disabled" });

    req.user = user._id;
    req.userRole = user.role;

    next();
  } catch {
    res.status(401).json({ message: "Token invalid" });
  }
};
