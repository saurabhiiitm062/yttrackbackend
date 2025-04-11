const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const router = express.Router();

router.post("/get-video-meta", async (req, res) => {
  const { videoUrl, userId } = req.body;
  const videoId = new URL(videoUrl).searchParams.get("v");

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`
    );

    if (response.data.items.length > 0) {
      const videoData = response.data.items[0].snippet;
      const videoMetadata = {
        title: videoData.title,
        thumbnail: videoData.thumbnails.high.url,
        videoUrl: videoUrl,
      };

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.trackedVideos.push(videoMetadata);
      await user.save();

      res.status(200).json({
        message: "Video added to track successfully",
        videoMetadata: videoMetadata,
      });
    } else {
      res.status(404).json({ error: "Video not found" });
    }
  } catch (err) {
    console.error("Error fetching video metadata:", err);
    res.status(500).json({ error: "Failed to fetch video metadata" });
  }
});

module.exports = router;
