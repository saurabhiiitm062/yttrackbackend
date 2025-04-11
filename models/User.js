const mongoose = require("mongoose");

// Schema for replies to comments
const ReplySchema = new mongoose.Schema({
  replyId: { type: String, required: true },
  text: { type: String, required: true },
  author: { type: String, required: true },
  likes: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

// Schema for comments on videos
const CommentSchema = new mongoose.Schema({
  commentId: { type: String, required: true },
  text: { type: String, required: true },
  author: { type: String, required: true },
  likes: { type: Number, default: 0 },
  replies: [ReplySchema],
  timestamp: { type: Date, default: Date.now },
});

// Schema for tracked videos
const TrackedVideoSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  videoUrl: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(v);
      },
      message: (props) => `${props.value} is not a valid YouTube URL!`,
    },
  },
  title: { type: String },
  description: { type: String },
  thumbnail: { type: String },
  comments: [CommentSchema],
  addedAt: { type: Date, default: Date.now },
});

// Schema for tracked comments (for comparison)
const TrackedCommentSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  comments: [CommentSchema],
});

// Schema for user data
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  trackedVideos: {
    type: [TrackedVideoSchema],
    default: [],
  },

  trackingUserId: { type: String, required: false },

  trackedComments: {
    type: [TrackedCommentSchema],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
