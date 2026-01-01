const express = require('express');
const statsController = require('../controllers/statsController');

const router = express.Router();

router.get('/admin/dashboard', statsController.getDashboardStats);

module.exports = router;