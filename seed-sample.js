require('dotenv').config();
const mongoose = require('mongoose');

// Models
const Doctor = require('./src/models/doctor');
const Patient = require('./src/models/patient');
const Appointment = require('./src/models/appointment');
const Treatment = require('./src/models/treatment');
const Specialty = require('./src/models/specialty');

// Utils
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad2 = (n) => n.toString().padStart(2, '0');
const randFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uniqueSuffix = () => Math.random().toString(36).slice(2, 8);

const makeSchedule = () => [
  { day: 'Monday', timeSlots: ['08:00-09:00', '09:00-10:00', '14:00-15:00'] },
  { day: 'Wednesday', timeSlots: ['10:00-11:00', '15:00-16:00'] },
  { day: 'Friday', timeSlots: ['08:00-09:00', '13:00-14:00'] }
];

async function ensureSpecialties() {
  let specs = await Specialty.find().limit(5);
  if (specs.length === 0) {
    specs = await Specialty.insertMany([
      { name: 'General Dentistry', description: 'Routine checkups and fillings' },
      { name: 'Orthodontics', description: 'Braces and alignment' },
      { name: 'Oral Surgery', description: 'Surgical procedures' },
      { name: 'Endodontics', description: 'Root canal treatments' },
      { name: 'Periodontics', description: 'Gum disease treatment' }
    ]);
    console.log(`✅ Created ${specs.length} specialties.`);
  }
  return specs;
}

function makeDoctorPayload(name, specialtyId, idx) {
  const slug = uniqueSuffix();
  return {
    name,
    specialtyId,
    phone: `+1${randomInt(2000000000, 9999999999)}`,
    email: `doctor.${slug}@clinic.com`,
    password: `pass${slug}!`,
    experience: randomInt(1, 25),
    schedule: makeSchedule()
  };
}

function makePatientPayload(idx) {
  const slug = uniqueSuffix();
  const year = randomInt(1975, 2005);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return {
    name: `Patient ${slug}`,
    dob: new Date(`${year}-${pad2(month)}-${pad2(day)}`),
    phone: `+1${randomInt(2000000000, 9999999999)}`,
    email: `patient.${slug}@mail.com`,
    password: `pw${slug}!`,
    address: `${randomInt(100,999)} Main St`,
    gender: randFrom(['male','female','other'])
  };
}

function makeAppointmentPayload(patient, doctor, specialtyId) {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(0, 14));
  const times = ['08:00-09:00','09:00-10:00','10:00-11:00','13:00-14:00','14:00-15:00'];
  return {
    booker_id: patient._id,
    profile: patient._id,
    profileModel: 'Patient',
    doctor_id: doctor._id,
    specialty_id: specialtyId,
    appointmentDate: date,
    timeSlot: randFrom(times),
    reason: randFrom(['Checkup','Tooth pain','Cleaning','Consultation','Follow-up']),
    status: randFrom(['pending','confirmed','waiting_assigned'])
  };
}

function makeTreatmentPayload(patient, doctor, appointment) {
  const meds = [
    { name: 'Ibuprofen', dosage: '400mg', frequency: '8h', duration: '3 days', instructions: 'With food' },
    { name: 'Amoxicillin', dosage: '500mg', frequency: '12h', duration: '5 days', instructions: 'Finish course' },
  ];
  return {
    patient: patient._id,
    doctor: doctor._id,
    appointment: appointment?._id,
    treatmentDate: appointment?.appointmentDate || new Date(),
    diagnosis: randFrom(['Caries', 'Gingivitis', 'Impacted tooth', 'Sensitivity']),
    laborder: randFrom(['X-ray', 'Blood test', 'No lab order']),
    prescription: [randFrom(meds)],
    totalCost: randomInt(50, 500)
  };
}

async function main() {
  console.log('🔗 Connecting to DB...');
  await mongoose.connect(process.env.MONGO_URL);
  console.log('✅ Connected');

  const specs = await ensureSpecialties();

  // Create 10 doctors
  console.log('🩺 Seeding doctors...');
  const doctorNames = [
    'Dr. John Smith','Dr. Sarah Lee','Dr. Michael Brown','Dr. Emily Davis','Dr. David Wilson',
    'Dr. Linda Taylor','Dr. Robert Miller','Dr. Karen Anderson','Dr. James Thomas','Dr. Susan Moore'
  ];
  const doctorsPayload = doctorNames.map((n, i) => makeDoctorPayload(n, randFrom(specs)._id, i));
  const doctors = await Doctor.insertMany(doctorsPayload);
  console.log(`✅ Inserted ${doctors.length} doctors`);

  // Ensure at least 10 patients (create 10 new ones)
  console.log('🧑‍⚕️ Seeding patients...');
  const patientPayloads = Array.from({ length: 10 }, (_, i) => makePatientPayload(i));
  const patients = await Patient.insertMany(patientPayloads);
  console.log(`✅ Inserted ${patients.length} patients`);

  // Create 10 appointments and 10 treatments
  console.log('📅 Seeding appointments and 🦷 treatments...');
  const appointments = [];
  const treatments = [];
  for (let i = 0; i < 10; i++) {
    const doctor = randFrom(doctors);
    const patient = randFrom(patients);
    const specialtyId = doctor.specialtyId;

    const ap = new Appointment(makeAppointmentPayload(patient, doctor, specialtyId));
    await ap.save();
    appointments.push(ap);

    const tr = new Treatment(makeTreatmentPayload(patient, doctor, ap));
    await tr.save();
    treatments.push(tr);
  }
  console.log(`✅ Inserted ${appointments.length} appointments and ${treatments.length} treatments`);

  // Summary
  console.log('\n📊 Seed summary');
  console.log(`Doctors: ${doctors.length}`);
  console.log(`Patients: ${patients.length}`);
  console.log(`Appointments: ${appointments.length}`);
  console.log(`Treatments: ${treatments.length}`);

  await mongoose.disconnect();
  console.log('📝 Disconnected');
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});