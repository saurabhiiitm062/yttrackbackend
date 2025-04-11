const cron = require("node-cron");
const nodemailer = require("nodemailer");
const axios = require("axios");
const User = require("../models/User");
const sanitize = require("sanitize-html");

// Helper function to sanitize input (for security)
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/<[^>]+>/g, "");
};

function extractVideoId(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:.*[?&]v=|.*\/)([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);

  if (!match) {
    console.error("Invalid YouTube URL or video ID:", url);
    return null;
  }
  return match[1] || match[2];
}

const fetchVideoComments = async (req, res) => {
  const { userId, videoId } = req.params;

  if (!userId || !videoId) {
    return res
      .status(400)
      .json({ error: "User ID and Video ID are required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const video = user.trackedVideos.find(
      (video) => video._id.toString() === videoId
    );
    if (!video) {
      return res
        .status(404)
        .json({ error: "Video not found in user's tracked videos." });
    }

    // Return the comments from the video directly from the database
    const videoComments = video.comments.map((comment) => ({
      commentId: comment.commentId,
      text: comment.text,
      author: comment.author,
      likes: comment.likes,
      timestamp: comment.timestamp,
      replies: comment.replies.map((reply) => ({
        replyId: reply.replyId,
        text: reply.text,
        author: reply.author,
        likes: reply.likes,
        timestamp: reply.timestamp,
      })),
    }));

    res.status(200).json({ comments: videoComments });
  } catch (err) {
    console.error("Error fetching video comments:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch video comments.", details: err.message });
  }
};

const fetchVideoMeta = async (req, res) => {
  const { videoUrl, userId } = req.body;

  if (!videoUrl || !userId) {
    return res
      .status(400)
      .json({ error: "Video URL and User ID are required." });
  }

  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Find the video in the tracked videos list
    const video = user.trackedVideos.find(
      (trackedVideo) => trackedVideo.videoId === videoId
    );

    if (!video) {
      return res
        .status(404)
        .json({ error: "Video not found in user's tracked list." });
    }
    res.status(200).json({
      videoId: video.videoId,
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail,
    });
  } catch (err) {
    console.error("Error fetching video metadata:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch video metadata.", details: err.message });
  }
};

const fetchYouTubeComments = async (userId, videoId, youtubeUserId) => {
  try {
    const comments = [];

    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found");
      return comments;
    }
    // console.log(user.trackedVideos);
    const video = user.trackedVideos.find(
      (video) => video._id.toString() === video.id
    );

    if (!video) {
      console.log(
        `Video with ID ${videoId} not found in the user's tracked list.`
      );
      return;
    }
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/commentThreads`,
      {
        params: {
          part: "snippet",
          videoId: videoId,
          textFormat: "plainText",
          key: process.env.YOUTUBE_API_KEY,
        },
      }
    );

    if (response.data.items && response.data.items.length > 0) {
      const filteredComments = response.data.items
        .map((item) => {
          const comment = item.snippet?.topLevelComment?.snippet;
          if (comment) {
            return {
              textDisplay: comment.textDisplay,
              authorDisplayName: comment.authorDisplayName,
              publishedAt: comment.publishedAt,
              commentId: item.id,
              videoId: videoId,
            };
          }
          return null;
        })
        .filter(Boolean)
        .filter((comment) => comment.authorDisplayName === youtubeUserId);

      comments.push(...filteredComments);
    } else {
      console.log(`No comments found for videoId ${videoId}`);
    }

    return comments;
  } catch (error) {
    console.error("Error fetching YouTube comments:", error.message);
    return comments;
  }
};

// Notify the user about selected videos via email
const notifyOnMail = async (req, res) => {
  const { userId, videoIds, youtubeUserId } = req.body;

  if (!userId || !videoIds || videoIds.length === 0 || !youtubeUserId) {
    return res
      .status(400)
      .json({ error: "User ID, Video IDs, and YouTube User ID are required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const selectedVideos = user.trackedVideos.filter((video) =>
      videoIds.includes(video._id.toString())
    );

    if (selectedVideos.length === 0) {
      return res
        .status(404)
        .json({ error: "No matching videos found in user's tracked list." });
    }

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emailContent = `
      <h3>Video Notifications</h3>
      <p>You have subscribed to notifications for the following videos:</p>
      <ul>
        ${selectedVideos
          .map(
            (video) =>
              `<li><strong>${sanitizeInput(
                video.title
              )}</strong> - ${sanitizeInput(video.videoId)}</li>`
          )
          .join("")}
      </ul>
      <p>You will receive an email when ${sanitizeInput(
        youtubeUserId
      )} comments on these videos.</p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "YouTube Video Notification Subscription",
      html: emailContent,
    });

    res.status(200).json({
      message: "Subscription successful. You will be notified by email.",
    });

    // Fetch YouTube comments every 1hrs using cron
    cron.schedule("0 * * * *", async () => {
      const newComments = await fetchYouTubeComments(
        userId,
        videoIds,
        youtubeUserId
      );
      const newCommentsForUser = await findNewComments(
        user,
        newComments,
        selectedVideos
      );

      if (newCommentsForUser.length > 0) {
        await sendNewCommentEmail(user, newCommentsForUser);
      }
    });
  } catch (err) {
    console.error("Error in notifyOnMail:", err.message);
    res.status(500).json({ error: "Failed to subscribe to notifications." });
  }
};
const findNewComments = async (user, youtubeComments, selectedVideos) => {
  const newComments = [];

  for (const comment of youtubeComments) {
    const video = selectedVideos.find(
      (video) => video.videoId === comment.videoId
    );
    if (
      video &&
      !video.comments.some(
        (existingComment) => existingComment.commentId === comment.commentId
      )
    ) {
      newComments.push({
        videoId: comment.videoId,
        text: comment.textDisplay,
        author: comment.authorDisplayName,
        publishedAt: comment.publishedAt,
      });
    }
  }

  return newComments;
};

const sendNewCommentEmail = async (user, newComments) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const emailContent = `
    <h3>New Comments on Tracked Videos</h3>
    <p>New comments from the YouTube User ${newComments[0].author}:</p>
    <ul>
      ${newComments
        .map(
          (comment) =>
            `<li><strong>${sanitizeInput(
              comment.author
            )}</strong>: ${sanitizeInput(
              comment.text
            )} on video <strong>${sanitizeInput(comment.videoId)}</strong></li>`
        )
        .join("")}
    </ul>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "New YouTube Comments on Your Tracked Videos",
      html: emailContent,
    });
  } catch (emailError) {
    console.error("Error sending email:", emailError.message);
  }
};

module.exports = {
  fetchVideoComments,
  fetchVideoMeta,
  notifyOnMail,
};
