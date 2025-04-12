const express = require("express");
const axios = require("axios");
const router = express.Router();

// POST /get-video-meta
router.post("/get-video-meta", async (req, res) => {
  const { videoUrl } = req.body;

  try {
    // Extract video ID from the YouTube URL
    const videoId = new URL(videoUrl).searchParams.get("v");

    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    // Make the API call to YouTube Data API
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`
    );

    const items = response.data.items;

    if (items && items.length > 0) {
      const { snippet, statistics } = items[0];

      // Handle case where statistics might be missing
      const stats = statistics || {
        viewCount: "N/A",
        likeCount: "N/A",
        commentCount: "N/A",
      };

      res.json({
        snippet,
        statistics: stats,
      });
    } else {
      res.status(404).json({ error: "Video not found" });
    }
  } catch (error) {
    console.error("Error fetching video metadata:", error.message);
    res.status(500).json({ error: "Failed to fetch video metadata" });
  }
});

module.exports = router;
