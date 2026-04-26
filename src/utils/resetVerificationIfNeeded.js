const User = require("../models/User");

module.exports = async function resetVerificationIfNeeded(userId, session = null) {
  const query = User.findById(userId);
  if (session) query.session(session);
  const user = await query;

  if (user && user.accountStatus === "VERIFIED") {
    user.accountStatus = "UNVERIFIED";
    await user.save(session ? { session } : {});
  }
};
