const patientsRoutes = require('./patientRoutes');
const appointmentsRoutes = require('./appointmentRoutes');
const servicesRoutes = require('./serviceRoutes');
const medicineRoutes = require('./medicineRoutes');
const labOrderRoutes = require('./labOrderRoutes');
const prescriptionRoutes = require('./prescriptionRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const medicalRecordRoutes = require('./medicalRecordRoutes');
const doctorRoutes = require('./doctorRoutes');
const accountRoutes = require('./accountRoutes');
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
    app.use('/medical-records', medicalRecordRoutes);
    app.use('/doctors', doctorRoutes);
    app.use('/accounts', accountRoutes);
}
