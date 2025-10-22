const patientsRoutes = require('./patientRoutes');
const appointmentsRoutes = require('./appointmentRoutes');
const doctorsRoutes = require('./doctorRoutes');
const treatmentsRoutes = require('./treatmentRoutes');

const express = require('express');
const router = express.Router();

module.exports = (app) => {
    app.use('/patients', patientsRoutes);
    app.use('/appointments', appointmentsRoutes);
    app.use('/doctors', doctorsRoutes);
    app.use('/treatments', treatmentsRoutes);
};