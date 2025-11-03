const express = require('express');
const router = express.Router();
const controller = require('../controllers/receptionistController');

// Thin routing only
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.get('/byAccount/:accountId', controller.getByAccountId);

module.exports = router;