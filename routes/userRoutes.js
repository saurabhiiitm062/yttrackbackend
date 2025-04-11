const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  updateUser,
  deleteUser,
  getUserDetails,
  addVideoToTrack,
} = require("../controllers/User");

// Register route
router.post("/register", registerUser);

// Login route
router.post("/login", loginUser);

// Update user route
router.put("/:id", updateUser);

// Delete user route
router.delete("/:id", deleteUser);
router.get("/:id", getUserDetails);
router.post("/add-video-to-track", addVideoToTrack);

module.exports = router;
