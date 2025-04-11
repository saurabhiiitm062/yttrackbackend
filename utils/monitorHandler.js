const Monitor = require("../models/Monitor");
const axios = require("axios");
const nodemailer = require("./email");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Save new monitoring data
exports.startMonitoring = async (req, res) => {
  const { videoUrl, youtubeUserId, userEmail } = req.body;

  const videoIdMatch = videoUrl.match(/(?:v=|\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!videoIdMatch) return res.status(400).send("Invalid YouTube URL");
  const videoId = videoIdMatch[1];

  try {
    const newMonitor = new Monitor({
      videoId,
      youtubeUserId,
      userEmail,
      lastCommentChecked: new Date(),
    });
    await newMonitor.save();
    res.status(201).send("Monitoring started successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error starting monitor");
  }
};

// Periodically check for new comments
exports.checkNewComments = async () => {
  const monitors = await Monitor.find();

  monitors.forEach(async (monitor) => {
    const { videoId, youtubeUserId, userEmail, lastCommentChecked } = monitor;

    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/commentThreads`,
        {
          params: {
            part: "snippet",
            videoId,
            key: YOUTUBE_API_KEY,
            maxResults: 10,
          },
        }
      );

      const comments = response.data.items;
      comments.forEach((comment) => {
        const authorId =
          comment.snippet.topLevelComment.snippet.authorChannelId.value;
        const commentDate = new Date(
          comment.snippet.topLevelComment.snippet.publishedAt
        );

        if (
          authorId === youtubeUserId &&
          commentDate > new Date(lastCommentChecked)
        ) {
          nodemailer.sendEmail(
            userEmail,
            "New Comment Alert",
            `The user you tracked commented: "${comment.snippet.topLevelComment.snippet.textDisplay}"`
          );

          monitor.lastCommentChecked = commentDate;
          monitor.save();
        }
      });
    } catch (err) {
      console.error("Error fetching comments:", err);
    }
  });
};
