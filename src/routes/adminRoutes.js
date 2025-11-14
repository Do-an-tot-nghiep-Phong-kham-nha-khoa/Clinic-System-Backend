const express = require('express');
const adminController = require('../controllers/adminController');
const { route } = require('./patientRoutes');

const router = express.Router();


router.get('/', adminController.getAdmins);

router.get('/:id', adminController.getAdmin);

router.post('/', adminController.createAdmin);

router.put('/:id', adminController.updatedAdmin);

router.delete('/:id', adminController.deleteAdmin);

module.exports = router;