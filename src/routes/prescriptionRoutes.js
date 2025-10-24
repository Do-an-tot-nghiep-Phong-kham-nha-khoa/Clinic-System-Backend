const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');

// Thin routing layer
router.get('/', prescriptionController.list);
router.post('/', prescriptionController.create);

module.exports = router;