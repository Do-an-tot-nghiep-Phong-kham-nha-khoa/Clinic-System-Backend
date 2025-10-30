require("dotenv").config();
const express = require("express");
const database = require("../config/database.js");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

app.use(cors({
  origin: 'http://localhost:8000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

database.connect();

const indexRoutes = require('./routes/indexRoutes');
indexRoutes(app);

app.get('/', (req, res) => {
  res.send('Hello Node.js!')
})

app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`)
})
