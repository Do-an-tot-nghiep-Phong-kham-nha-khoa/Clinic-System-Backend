const express = require('express');
const router = express.Router();
const controller = require('../controllers/serviceController');

// List with paging/filter/search
router.get('/', controller.list);
// Create
router.post('/', controller.create);
// Get by _id
router.get('/:id', controller.get);
// Update by _id
router.put('/:id', controller.update);
// Delete by _id
router.delete('/:id', controller.remove);

module.exports = router;