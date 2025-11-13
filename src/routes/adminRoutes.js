const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

// Tạo admin mới
router.post("/", adminController.create);

module.exports = router;
