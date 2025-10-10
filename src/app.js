// index.js
require("dotenv").config();
const express = require("express");
const database = require("../config/database.js");

const app = express();

database.connect();

// ...
const patientRoutes = require("./routes/patientRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const labOrderRoutes = require("./routes/labOrderRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const medicineInPrescriptionRoutes = require("./routes/medicineInPrescriptionRoutes");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/src/patients", patientRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/laborders", labOrderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/medicineinprescriptions", medicineInPrescriptionRoutes);

app.get('/', (req, res) => {
  res.send('Hello Node.js!')
})

app.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`)
})
