const cloudinary = require("./cloudinary");

exports.deleteImage = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
};
