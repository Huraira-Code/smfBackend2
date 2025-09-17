const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const historySchema = new mongoose.Schema({
  type: { type: String, required: true },
  imgUrl: { type: String, required: true },
  dateTime: { type: Date, default: Date.now },
  result: { type: mongoose.Schema.Types.Mixed }, // or define shape if needed
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    default: null,
  },
  history: {
    type: [historySchema],
    default: [], // ✅ default empty array
  },
  verifyEmailToken: String,
  verifyEmailExpiry: Date,
  forgotPasswordToken: String,
  forgotPasswordExpiry: Date,
});
// Pre-save hook for password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance methods
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, email: this.email },
    process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRY }
  );
};

userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.generateForgotPasswordToken = function () {
  // Generate a 6-digit numeric code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  this.forgotPasswordToken = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  this.forgotPasswordExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

  return resetCode; // Send plain code to user (email/SMS)
};

userSchema.methods.generateVerifyEmailToken = function () {
  const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

  this.verifyEmailToken = crypto
    .createHash("sha256")
    .update(verifyCode)
    .digest("hex");

  this.verifyEmailExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

  return verifyCode;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
