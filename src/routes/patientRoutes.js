const express = require("express");
const controller = require("../controllers/patientController");
const router = express.Router();


router.get("/:id", controller.getPatientById);

router.get("/", controller.getAllPatients);

router.post("/", controller.createPatient);

router.delete("/:id", controller.deletePatient);
// Lấy patient theo accountId
router.get('/account/:accountId', controller.getByAccountId);
 
router.put('/:id', controller.updatePatient);

module.exports = router;
