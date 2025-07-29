const cloudinary = require("cloudinary");
const fs = require("fs");

cloudinary.config({
  cloud_name: "dmv503tlb",
  api_key: "438173559891557",
  api_secret: "Dlj_jS_1mVRni6zIXTEwN6cuNUo",
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file has been uploaded successfull
    console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    console.log(error)
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

module.exports = uploadOnCloudinary;

// cloudinary.config({
//   cloud_name: "dvljt7fa1",
//   api_key: "396798289336679",
//   api_secret: "WKwcMFE8YxuZlj_ZMTq7KYDhtio",
// });
