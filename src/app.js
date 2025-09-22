// index.js
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.get('/', (req, res) => {
  res.send('Hello Node.js!')
})

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000')
})
