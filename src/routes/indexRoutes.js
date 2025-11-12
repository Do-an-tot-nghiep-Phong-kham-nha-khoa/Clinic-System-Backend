const patientsRoutes = require('./patientRoutes');
const appointmentsRoutes = require('./appointmentRoutes');
const servicesRoutes = require('./serviceRoutes');
const medicineRoutes = require('./medicineRoutes');
const labOrderRoutes = require('./labOrderRoutes');
const prescriptionRoutes = require('./prescriptionRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const doctorRoutes = require('./doctorRoutes');
const accountRoutes = require('./accountRoutes');
const healthProfileRoutes = require('./healthProfileRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const specialtyRoutes = require('./specialtyRoutes');
const receptionistRoutes = require('./receptionistRoutes');
const familyMemberRoutes = require('./familyMemberRoutes');
const roleRoutes = require('./roleRoutes');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

module.exports = (app) => {
    app.use('/patients', patientsRoutes);
    app.use('/appointments', authenticate.authenticate, authorize.authorize('appointment'), appointmentsRoutes);
    app.use('/services', servicesRoutes);
    app.use('/medicines', medicineRoutes);
    app.use('/laborders', labOrderRoutes);
    app.use('/prescriptions', prescriptionRoutes);
    app.use('/invoices', invoiceRoutes);
    app.use('/doctors', doctorRoutes);
    app.use('/accounts', accountRoutes);
    app.use('/health-profiles', healthProfileRoutes);
    app.use('/schedules', scheduleRoutes);
    app.use('/specialties', specialtyRoutes);
    app.use('/receptionists', receptionistRoutes);
    app.use('/family-members', familyMemberRoutes);
    app.use('/admin/roles', roleRoutes);
}
