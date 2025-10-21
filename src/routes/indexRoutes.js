const patientsRoutes = require('./patientsRoutes');
const appointmentsRoutes = require('./appointmentRoutes');

const express = require('express');
const router = express.Router();

module.exports = (app) => {
    app.use('/patients', patientsRoutes);
    app.use('/appointments', appointmentsRoutes);
}