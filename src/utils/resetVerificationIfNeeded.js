const User = require("../models/User");

module.exports = async function resetVerificationIfNeeded(userId) {
  const user = await User.findById(userId);

  if (user.accountStatus === "VERIFIED") {
    user.accountStatus = "UNVERIFIED";
    await user.save();
  }
};
