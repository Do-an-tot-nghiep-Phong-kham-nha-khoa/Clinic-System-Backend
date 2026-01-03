const Patient = require('../models/patient');
const FamilyMember = require('../models/familyMember');
const Doctor = require('../models/doctor');
const Specialty = require('../models/specialty');
const HealthProfile = require('../models/healthProfile');

/**
 * Tạo patient snapshot từ healthProfile
 * @param {String} healthProfileId - ID của health profile
 * @returns {Object|null} Patient snapshot hoặc null
 */
async function createPatientSnapshot(healthProfileId) {
  try {
    const healthProfile = await HealthProfile.findById(healthProfileId);
    if (!healthProfile || !healthProfile.ownerId || !healthProfile.ownerModel) {
      return null;
    }

    let owner;
    if (healthProfile.ownerModel === 'Patient') {
      owner = await Patient.findById(healthProfile.ownerId).select('name dob phone gender');
    } else if (healthProfile.ownerModel === 'FamilyMember') {
      owner = await FamilyMember.findById(healthProfile.ownerId).select('name dob phone gender');
    }

    if (!owner) return null;

    return {
      name: owner.name,
      dob: owner.dob,
      phone: owner.phone,
      gender: owner.gender,
      ownerModel: healthProfile.ownerModel
    };
  } catch (error) {
    console.error('Error creating patient snapshot:', error);
    return null;
  }
}

/**
 * Tạo doctor snapshot từ doctor_id
 * @param {String} doctorId - ID của doctor
 * @returns {Object|null} Doctor snapshot hoặc null
 */
async function createDoctorSnapshot(doctorId) {
  try {
    if (!doctorId) return null;

    const doctor = await Doctor.findById(doctorId).select('name phone experience avatar');
    if (!doctor) return null;

    return {
      name: doctor.name,
      phone: doctor.phone,
      experience: doctor.experience,
      avatar: doctor.avatar
    };
  } catch (error) {
    console.error('Error creating doctor snapshot:', error);
    return null;
  }
}

/**
 * Tạo specialty snapshot từ specialty_id
 * @param {String} specialtyId - ID của specialty
 * @returns {Object|null} Specialty snapshot hoặc null
 */
async function createSpecialtySnapshot(specialtyId) {
  try {
    const specialty = await Specialty.findById(specialtyId).select('name description');
    if (!specialty) return null;

    return {
      name: specialty.name,
      description: specialty.description
    };
  } catch (error) {
    console.error('Error creating specialty snapshot:', error);
    return null;
  }
}

/**
 * Batch tạo snapshots cho nhiều appointments
 * @param {Array} appointments - Array of appointment documents
 * @returns {Array} Array of appointments with snapshots
 */
async function batchCreateSnapshots(appointments) {
  try {
    // Collect unique IDs
    const healthProfileIds = [...new Set(appointments.map(a => a.healthProfile_id?.toString()).filter(Boolean))];
    const doctorIds = [...new Set(appointments.map(a => a.doctor_id?.toString()).filter(Boolean))];
    const specialtyIds = [...new Set(appointments.map(a => a.specialty_id?.toString()).filter(Boolean))];

    // Batch fetch all health profiles
    const healthProfiles = await HealthProfile.find({ _id: { $in: healthProfileIds } });
    const ownerIds = {
      Patient: [],
      FamilyMember: []
    };

    healthProfiles.forEach(hp => {
      if (hp.ownerModel && hp.ownerId) {
        ownerIds[hp.ownerModel].push(hp.ownerId);
      }
    });

    // Batch fetch all owners
    const [patients, familyMembers, doctors, specialties] = await Promise.all([
      Patient.find({ _id: { $in: ownerIds.Patient } }).select('name dob phone gender'),
      FamilyMember.find({ _id: { $in: ownerIds.FamilyMember } }).select('name dob phone gender'),
      Doctor.find({ _id: { $in: doctorIds } }).select('name phone experience avatar'),
      Specialty.find({ _id: { $in: specialtyIds } }).select('name description')
    ]);

    // Create lookup maps
    const healthProfileMap = new Map(healthProfiles.map(hp => [hp._id.toString(), hp]));
    const patientMap = new Map(patients.map(p => [p._id.toString(), p]));
    const familyMemberMap = new Map(familyMembers.map(fm => [fm._id.toString(), fm]));
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));
    const specialtyMap = new Map(specialties.map(s => [s._id.toString(), s]));

    // Apply snapshots to appointments
    return appointments.map(app => {
      const appObj = app.toObject ? app.toObject() : app;

      // Patient snapshot
      const hp = healthProfileMap.get(appObj.healthProfile_id?.toString());
      if (hp) {
        const ownerMap = hp.ownerModel === 'Patient' ? patientMap : familyMemberMap;
        const owner = ownerMap.get(hp.ownerId?.toString());
        if (owner) {
          appObj.patientSnapshot = {
            name: owner.name,
            dob: owner.dob,
            phone: owner.phone,
            gender: owner.gender,
            ownerModel: hp.ownerModel
          };
        }
      }

      // Doctor snapshot
      const doctor = doctorMap.get(appObj.doctor_id?.toString());
      if (doctor) {
        appObj.doctorSnapshot = {
          name: doctor.name,
          phone: doctor.phone,
          experience: doctor.experience,
          avatar: doctor.avatar
        };
      }

      // Specialty snapshot
      const specialty = specialtyMap.get(appObj.specialty_id?.toString());
      if (specialty) {
        appObj.specialtySnapshot = {
          name: specialty.name,
          description: specialty.description
        };
      }

      return appObj;
    });
  } catch (error) {
    console.error('Error in batch creating snapshots:', error);
    return appointments;
  }
}

module.exports = {
  createPatientSnapshot,
  createDoctorSnapshot,
  createSpecialtySnapshot,
  batchCreateSnapshots
};
