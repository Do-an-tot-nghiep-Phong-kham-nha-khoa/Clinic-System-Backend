const patientsRoutes = require('./patientRoutes');
const appointmentsRoutes = require('./appointmentRoutes');
const servicesRoutes = require('./serviceRoutes');
const medicineRoutes = require('./medicineRoutes');
const labOrderRoutes = require('./labOrderRoutes');
const prescriptionRoutes = require('./prescriptionRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const doctorRoutes = require('./doctorRoutes');
const treatmentRoutes = require('./treatmentRoutes');
const medicalRecordRoutes = require('./medicalRecordRoutes');
const express = require('express');
const router = express.Router();

module.exports = (app) => {
    app.use('/patients', patientsRoutes);
    app.use('/appointments', appointmentsRoutes);
    app.use('/services', servicesRoutes);
    app.use('/medicines', medicineRoutes);
    app.use('/laborders', labOrderRoutes);
    app.use('/prescriptions', prescriptionRoutes);
    app.use('/invoices', invoiceRoutes);
    app.use('/doctors', doctorRoutes);
    app.use('/treatments', treatmentRoutes);
    app.use('/medical-records', medicalRecordRoutes);
}
