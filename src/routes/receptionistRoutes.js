const express = require('express');
const router = express.Router();
const controller = require('../controllers/receptionistController');

// Thin routing only
router.get('/', controller.getReceptionists);
router.get('/:id', controller.getReceptionist);
router.post('/', controller.createReceptionist);
router.put('/:id', controller.updatedReceptionist);
router.delete('/:id', controller.deletedReceptionist);
router.get('/byAccount/:accountId', controller.getByAccountId);

module.exports = router;