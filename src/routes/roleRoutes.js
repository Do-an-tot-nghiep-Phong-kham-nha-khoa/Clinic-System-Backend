const controller = require('../controllers/roleController');
const express = require('express');
const router = express.Router();

router.get('/', controller.index);

router.post('/', controller.create);
router.patch('/:id', controller.editRoles);
router.patch('/:id/permissions', controller.editPermissions);
router.delete('/:id', controller.delete);

module.exports = router;