const dotenv = require("dotenv");
// Load .env immediately so any required modules (routes/middlewares) can read process.env
dotenv.config();
const express = require("express");
const cors = require("cors");
const database = require("../config/database.js");
const cookieParser = require("cookie-parser");
const indexRoutes = require("./routes/indexRoutes.js");
const app = express();

const allowedOrigins = [
  'http://localhost:8000',
  'https://clinic-system-frontend-pi.vercel.app'
];


app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// connect database (env already loaded above)
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
