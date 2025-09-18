const express = require("express");
const upload = require("../middleware/multer.js");
const {
  handleUserSignUp,
  handleUserLogin,
  handleViewProfile,
  changePassword,
  sendDataToGPT,
  sendDataForRecommendation,
  forgetPasswordSend,
  handleRepeatTokenSend,
  // VerifyToken,
  forgetPasswordChange,
  addUserHistory,
  getUserHistory,
  sendToDeepSeek,
  addProfileImage,
  // changeForgetPassword
} = require("../controllers/user_controller");
const router = express.Router();

// Sign UP & Login
router.route("/signUp").post(handleUserSignUp);
router.route("/login").post(handleUserLogin);
router.route("/viewProfile").post(handleViewProfile);
router.route("/addProfileImage").post(upload.single("file"), addProfileImage);
router.route("/changePassword").post(changePassword);
router.route("/sendDataToGPT").post(upload.single("file"), sendDataToGPT);
router.route("/sendDataForRecommendation").post(sendDataForRecommendation);
router.route("/forgetPasswordSend").post(forgetPasswordSend);
router.route("/SendRepeatToken").post(handleRepeatTokenSend);
// router.route("/verifyToken").post(VerifyToken);
router.route("/forgetPasswordChange").post(forgetPasswordChange);
router.route("/forgetPasswordSend").post(forgetPasswordSend);
router.route("/changePassword").post(changePassword);
router.route("/history").get(getUserHistory);
router.post("/ask", sendToDeepSeek);

router.route("/addUserHistory").post(upload.single("file"), addUserHistory);

// router.route("/changeForgetPassword").post(changeForgetPassword);

module.exports = router;
