const express = require("express");
const router = express.Router();
const {
  fetchVideoComments,
  fetchVideoMeta,
  notifyOnMail, // Import the new controller
} = require("../controllers/ytcontrollers");

// Route to fetch comments for a specific video
router.get("/:userId/:videoId/comments", fetchVideoComments);

// Route to fetch video metadata
router.post("/get-video-meta", fetchVideoMeta);

// Route to notify user by mail about selected videos
router.post("/subscribe", notifyOnMail);

module.exports = router;
