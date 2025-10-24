const express = require('express');
const router = express.Router();
const controller = require('../controllers/labOrderController');

router.get('/', controller.list);
router.post('/', controller.create);

module.exports = router;