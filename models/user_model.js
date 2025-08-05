const mongoose = require("mongoose");

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
    default : null
  },
  history: {
    type: [historySchema],
    default: [], // ✅ default empty array
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
