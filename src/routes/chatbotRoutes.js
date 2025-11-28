const express = require('express');
const controller = require("../controllers/chatbotController");
const chatLimit = require("../middlewares/rateLimit");
const router = express.Router();

router.post("/new-conversation", async (req, res) => {
  try {
    const convId = "conv_" + Date.now();

    return res.json({
      success: true,
      conversationId: convId
    });
  } catch (err) {
    console.error("Error starting conversation:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
router.post('/chat', chatLimit.chatLimiter, controller.chatWithBot);

module.exports = router;