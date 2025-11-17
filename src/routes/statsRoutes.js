const express = require('express');
const statsController = require('../controllers/statsController');

const router = express.Router();

router.get("/appointments/last7days", statsController.getAppointmentsLast7Days);
router.get("/revenue/last7days", statsController.getRevenueLast7Days);
router.get("/appointments/status", statsController.getAppointmentStatusStats);
router.get("/revenue/total", statsController.getTotalRevenue);
router.get("/top/medicines", statsController.getTopMedicines);
router.get("/top/services", statsController.getTopServices);

module.exports = router;