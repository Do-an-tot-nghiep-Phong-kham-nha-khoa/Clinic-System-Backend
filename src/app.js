// index.js
require("dotenv").config();
const express = require("express");
const database = require("../config/database.js");

const app = express();

database.connect();

app.get('/', (req, res) => {
  res.send('Hello Node.js!')
})

app.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`)
})

const patientRoutes = require("./routes/patientRoutes");

app.use("/src/patients", patientRoutes);
