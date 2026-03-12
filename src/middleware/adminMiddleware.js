module.exports = (req, res, next) => {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
