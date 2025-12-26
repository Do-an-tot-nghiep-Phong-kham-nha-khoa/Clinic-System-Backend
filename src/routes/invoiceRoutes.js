const express = require("express");
const router = express.Router();
const controller = require("../controllers/invoiceController");
const { authenticate } = require("../middlewares/authenticate");

// Log middleware để debug
// Thin routing only
router.get("/", controller.list);

// Patient-specific route (phải đặt TRƯỚC /:id)
router.get(
  "/patient/:accountId",
  controller.getInvoicesForAuthenticatedPatient
);

// VNPay routes (đặt trước /:id)
router.get("/vnpay/return", controller.vnpayReturn);
router.get("/vnpay/ipn", controller.vnpayIPN);

// VNPay mock payment endpoints (giữ lại cho test)
router.get("/mock/vnpay/checkout", controller.mockVnPayCheckout);
router.post("/mock/vnpay/complete", controller.mockVnPayComplete);

// Generic routes với :id phải đặt CUỐI

router.get("/:id", controller.getById);
router.patch("/:id/status", controller.updateStatus);
router.post("/:id/pay/cash", authenticate, controller.payCash); // Thêm authenticate
router.post("/:id/pay/vnpay", authenticate, controller.createVnPayPayment); // Thêm authenticate
module.exports = router;
