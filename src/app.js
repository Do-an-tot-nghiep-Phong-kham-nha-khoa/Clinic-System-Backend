require("dotenv").config();
const express = require("express");
const database = require("../config/database.js");

const app = express();

// ...
const serviceRoutes = require("./routes/serviceRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const labOrderRoutes = require("./routes/labOrderRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

app.use("/api/services", serviceRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/laborders", labOrderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/invoices", invoiceRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
database.connect();

const indexRoutes = require('./routes/indexRoutes');
indexRoutes(app);

app.get('/', (req, res) => {
  res.send('Hello Node.js!')
})

app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`)
})
