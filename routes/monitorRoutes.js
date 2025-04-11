const express = require("express");
const axios = require("axios");
const router = express.Router();

// API route to fetch YouTube video metadata
router.post("/get-video-meta", async (req, res) => {
  const { videoUrl } = req.body;
  const videoId = new URL(videoUrl).searchParams.get("v");
  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    if (response.data.items.length > 0) {
      res.json(response.data.items[0].snippet);
    } else {
      res.status(404).json({ error: "Video not found" });
    }
  } catch (err) {
    console.error("Error fetching video metadata:", err);
    res.status(500).json({ error: "Failed to fetch video metadata" });
  }
});

module.exports = router;
