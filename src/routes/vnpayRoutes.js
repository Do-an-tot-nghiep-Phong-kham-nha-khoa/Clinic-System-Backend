const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.get('/return', invoiceController.vnpayReturn);
router.get('/ipn', invoiceController.vnpayIPN);

module.exports = router;