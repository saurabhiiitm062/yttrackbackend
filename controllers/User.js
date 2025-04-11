const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const router = express.Router();

const registerUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const user = new User({ email, password });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.status(200).json({
      message: "Login successful",
      userId: user._id,
      email: user.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getUserDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      email: user.email,
      trackedVideos: user.trackedVideos,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (email) user.email = email;
    if (password) user.password = password;
    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const fetchAllComments = async (videoId, apiKey) => {
  const comments = [];
  let nextPageToken = null;
  try {
    do {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/commentThreads`,
        {
          params: {
            part: "snippet",
            videoId,
            key: apiKey,
            maxResults: 100,
            pageToken: nextPageToken,
          },
        }
      );
      comments.push(
        ...response.data.items.map((comment) => ({
          author: comment.snippet.topLevelComment.snippet.authorDisplayName,
          text: comment.snippet.topLevelComment.snippet.textOriginal,
          likeCount: comment.snippet.topLevelComment.snippet.likeCount,
          publishedAt: comment.snippet.topLevelComment.snippet.publishedAt,
        }))
      );
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);
    return comments;
  } catch (error) {
    console.error(
      "Error fetching comments:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch comments");
  }
};

const addVideoToTrack = async (req, res) => {
  const { userId, videoUrl } = req.body;
  if (!userId || !videoUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube video URL" });
    }
    const existingUser = await User.findOne({
      _id: userId,
      trackedVideos: { $elemMatch: { videoId } },
    });
    if (existingUser) {
      return res.status(400).json({ error: "Video is already tracked" });
    }
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const videoDetails = await fetchAllCommentsWithVideoDetails(
      videoId,
      YOUTUBE_API_KEY
    );
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          trackedVideos: {
            videoId,
            videoUrl,
            title: videoDetails.videoTitle,
            description: videoDetails.videoDescription,
            thumbnail: videoDetails.videoThumbnail,
            comments: videoDetails.commentList,
          },
        },
      },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: "Video tracked successfully", user });
  } catch (error) {
    console.error(
      "Error tracking video:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to track video" });
  }
};

const fetchAllCommentsWithVideoDetails = async (videoId, apiKey) => {
  const comments = [];
  let nextPageToken = null;
  let videoTitle = "";
  let videoDescription = "";
  let videoThumbnail = "";
  try {
    const videoResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoId}&part=snippet`
    );
    const videoData = videoResponse.data.items[0]?.snippet || {};
    videoTitle = videoData.title || "Unknown Title";
    videoDescription = videoData.description || "No description available";
    videoThumbnail = videoData.thumbnails?.high?.url || "";
  } catch (err) {
    console.error("Error fetching video details:", err.message);
    throw new Error("Failed to fetch video details");
  }
  do {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/commentThreads?key=${apiKey}&videoId=${videoId}&part=snippet,replies&maxResults=100&pageToken=${
          nextPageToken || ""
        }`
      );
      response.data.items.forEach((item) => {
        const topLevelComment = item.snippet.topLevelComment.snippet;
        const replies =
          item.replies?.comments?.map((reply) => ({
            replyId: reply.id,
            text: reply.snippet.textDisplay,
            author: reply.snippet.authorDisplayName,
          })) || [];
        comments.push({
          commentId: item.id,
          text: topLevelComment.textDisplay,
          author: topLevelComment.authorDisplayName,
          replies,
        });
      });
      nextPageToken = response.data.nextPageToken;
    } catch (err) {
      console.error("Error fetching comments:", err.message);
      throw new Error("Failed to fetch comments");
    }
  } while (nextPageToken);
  return {
    videoTitle,
    videoDescription,
    videoThumbnail,
    commentList: comments,
  };
};

function extractVideoId(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*v=([^&\s]+)|youtu\.be\/([^&\s]+)/;
  const match = url.match(regex);
  return match ? match[1] || match[2] : null;
}

module.exports = {
  registerUser,
  loginUser,
  updateUser,
  deleteUser,
  getUserDetails,
  addVideoToTrack,
};
