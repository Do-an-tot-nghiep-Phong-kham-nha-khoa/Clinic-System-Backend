const express = require('express');
const controller = require('../controllers/healthProfileController');
const router = express.Router();

// Specific routes first to avoid being shadowed by generic param routes
router.post('/:ownerModel/:ownerId', controller.createHealthProfileNew);
router.get('/all/:patientId', controller.getAllHealthProfiles);
// update by profile id
router.patch('/profile/:profileId', controller.updateHealthProfileById);
router.delete('/profile/:profileId', controller.deleteHealthProfileById);
module.exports = router;