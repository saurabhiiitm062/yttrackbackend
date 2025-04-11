const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const monitorRoutes = require("./routes/monitorRoutes");
const userRoutes = require("./routes/userRoutes");
const ytRoutes = require("./routes/ytroutes");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});
app.use(limiter);

// Validate required environment variables
if (!process.env.MONGO_URI) {
  console.error("Error: MONGO_URI not defined in .env");
  process.exit(1);
}

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); // Exit the application if the database connection fails
  });

app.get("/", (req, res) => {
  res.send("API is running...");
});

// API routes
app.use("/api/monitor", monitorRoutes);
app.use("/api/user", userRoutes);
app.use("/api/videos", ytRoutes); // This includes /subscribe

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error("Error stack:", err.stack);
  res.status(500).send({ message: "Internal Server Error" });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
