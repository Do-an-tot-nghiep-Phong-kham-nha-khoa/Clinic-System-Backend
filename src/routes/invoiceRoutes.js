const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');

// Thin routing only
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.patch('/:id/status', controller.updateStatus);

module.exports = router;