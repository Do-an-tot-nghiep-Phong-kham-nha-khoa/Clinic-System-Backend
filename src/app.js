const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const database = require("../config/database.js");
const chatbot = require("./helpers/chatbot.js");
const indexRoutes = require('./routes/indexRoutes');
const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// load env and connect database
dotenv.config();
database.connect();

indexRoutes(app);

app.get('/', (req, res) => {
  res.send('Hello Node.js!');
});

app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const botReply = await chatbot.getChatReply(userMessage);
    res.json({ reply: botReply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chatbot error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
