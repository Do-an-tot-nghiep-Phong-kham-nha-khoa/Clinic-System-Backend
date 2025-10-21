require("dotenv").config();
const express = require("express");
const database = require("../config/database.js");

const app = express();

database.connect();

const indexRoutes = require('./routes/indexRoutes');
indexRoutes(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Hello Node.js!')
})

app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`)
})
