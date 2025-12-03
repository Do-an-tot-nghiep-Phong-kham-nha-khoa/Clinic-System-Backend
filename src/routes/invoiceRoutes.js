const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');

// Log middleware để debug
// Thin routing only
router.get('/', controller.list);

// Patient-specific route (phải đặt TRƯỚC /:id)
router.get('/patient/:accountId', controller.getInvoicesForAuthenticatedPatient);

// VNPay routes (đặt trước /:id)
router.get('/vnpay/return', controller.vnpayReturn);
router.get('/vnpay/ipn', controller.vnpayIPN);


// Generic routes với :id phải đặt CUỐI

router.get('/:id', controller.getById);
router.patch('/:id/status', controller.updateStatus);
router.post('/:id/pay/cash', controller.payCash); // API mới cho thanh toán tiền mặt
router.post('/:id/pay/vnpay', controller.createVnPayPayment);
module.exports = router;