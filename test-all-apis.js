// Comprehensive API Test Script for Dental Clinic Backend
require("dotenv").config();
const mongoose = require("mongoose");
const Doctor = require("./src/models/doctor");
const Patient = require("./src/models/patient");
const Appointment = require("./src/models/appointment");
const Treatment = require("./src/models/treatment");

async function testAllAPIs() {
  try {
    console.log("🔗 Connecting to database...");
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected to database successfully!\n");

    // Clear existing data for clean test
    console.log("🧹 Cleaning existing data...");
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await Appointment.deleteMany({});
    await Treatment.deleteMany({});
    console.log("✅ Database cleaned\n");

    // Test 1: Create Doctors
    console.log("👨‍⚕️ TESTING DOCTORS");
    console.log("===================");
    
    const doctor1 = new Doctor({
      name: "Dr. John Smith",
      email: "john.smith@dentalclinic.com",
      phone: "+1234567890",
      gender: "Male",
      address: "123 Main Street, City",
      expertise: {
        name: "General Dentistry",
        description: "General dental care and consultations"
      }
    });

    const doctor2 = new Doctor({
      name: "Dr. Sarah Wilson",
      email: "sarah.wilson@dentalclinic.com",
      phone: "+1987654321",
      gender: "Female",
      address: "456 Oak Avenue, City",
      expertise: {
        name: "Orthodontics",
        description: "Braces and teeth alignment specialist"
      }
    });

    const savedDoctor1 = await doctor1.save();
    const savedDoctor2 = await doctor2.save();
    
    console.log(`✅ Doctor 1 created: ${savedDoctor1.name} - ID: ${savedDoctor1._id}`);
    console.log(`✅ Doctor 2 created: ${savedDoctor2.name} - ID: ${savedDoctor2._id}\n`);

    // Test 2: Create Patients
    console.log("👤 TESTING PATIENTS");
    console.log("==================");
    
    const patient1 = new Patient({
      name: "Alice Johnson",
      phone: "+1111222333",
      email: "alice.johnson@email.com",
      address: "789 Pine Street, City",
      dob: new Date("1990-05-15")
    });

    const patient2 = new Patient({
      name: "Bob Brown",
      phone: "+1444555666",
      email: "bob.brown@email.com",
      address: "321 Cedar Lane, City",
      dob: new Date("1985-03-20")
    });

    const savedPatient1 = await patient1.save();
    const savedPatient2 = await patient2.save();
    
    console.log(`✅ Patient 1 created: ${savedPatient1.name} - ID: ${savedPatient1._id}`);
    console.log(`✅ Patient 2 created: ${savedPatient2.name} - ID: ${savedPatient2._id}\n`);

    // Test 3: Create Appointments
    console.log("📅 TESTING APPOINTMENTS");
    console.log("======================");
    
    const appointment1 = new Appointment({
      patient: savedPatient1._id,
      doctor: savedDoctor1._id,
      appointmentDate: new Date("2025-10-15"),
      appointmentTime: "09:00",
      treatmentType: "Consultation",
      notes: "Regular checkup",
      symptoms: ["Tooth pain", "Sensitivity"],
      urgencyLevel: "Medium",
      estimatedCost: 100,
      room: "Room 101"
    });

    const appointment2 = new Appointment({
      patient: savedPatient2._id,
      doctor: savedDoctor2._id,
      appointmentDate: new Date("2025-10-16"),
      appointmentTime: "14:30",
      treatmentType: "Cleaning",
      notes: "Routine cleaning",
      urgencyLevel: "Low",
      estimatedCost: 80,
      room: "Room 102"
    });

    const savedAppointment1 = await appointment1.save();
    const savedAppointment2 = await appointment2.save();
    
    console.log(`✅ Appointment 1 created: ${savedAppointment1.treatmentType} - ID: ${savedAppointment1._id}`);
    console.log(`✅ Appointment 2 created: ${savedAppointment2.treatmentType} - ID: ${savedAppointment2._id}\n`);

    // Test 4: Create Treatments
    console.log("🦷 TESTING TREATMENTS");
    console.log("====================");
    
    const treatment1 = new Treatment({
      patient: savedPatient1._id,
      doctor: savedDoctor1._id,
      appointment: savedAppointment1._id,
      treatmentDate: new Date("2025-10-15"),
      treatmentType: "Filling",
      teeth: [
        {
          toothNumber: "16",
          condition: "Cavity",
          treatmentApplied: "Composite filling"
        }
      ],
      diagnosis: "Dental caries on tooth 16",
      treatment: "Composite filling placement",
      medications: [
        {
          name: "Ibuprofen",
          dosage: "400mg",
          frequency: "Every 6 hours",
          duration: "3 days",
          instructions: "Take with food"
        }
      ],
      materials: [
        {
          name: "Composite resin",
          quantity: 1,
          cost: 25
        }
      ],
      procedures: [
        {
          name: "Cavity preparation and filling",
          description: "Removed decay and placed composite filling",
          cost: 150
        }
      ],
      totalCost: 175,
      notes: "Patient tolerated procedure well"
    });

    const savedTreatment1 = await treatment1.save();
    console.log(`✅ Treatment 1 created: ${savedTreatment1.treatmentType} - ID: ${savedTreatment1._id}\n`);

    // Update appointment status to completed
    await Appointment.findByIdAndUpdate(savedAppointment1._id, { 
      status: "Completed",
      actualCost: 175
    });

    // Test 5: Query All Data
    console.log("📊 TESTING QUERIES");
    console.log("=================");
    
    const allDoctors = await Doctor.find();
    const allPatients = await Patient.find();
    const allAppointments = await Appointment.find().populate('doctor patient');
    const allTreatments = await Treatment.find().populate('doctor patient appointment');

    console.log(`📋 Total Doctors: ${allDoctors.length}`);
    allDoctors.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.name} - ${doc.expertise.name}`);
    });

    console.log(`\n📋 Total Patients: ${allPatients.length}`);
    allPatients.forEach((patient, index) => {
      console.log(`   ${index + 1}. ${patient.name} - ${patient.email}`);
    });

    console.log(`\n📋 Total Appointments: ${allAppointments.length}`);
    allAppointments.forEach((apt, index) => {
      console.log(`   ${index + 1}. ${apt.treatmentType} - ${apt.status} - ${apt.appointmentDate.toDateString()}`);
    });

    console.log(`\n📋 Total Treatments: ${allTreatments.length}`);
    allTreatments.forEach((treatment, index) => {
      console.log(`   ${index + 1}. ${treatment.treatmentType} - $${treatment.totalCost} - ${treatment.treatmentStatus}`);
    });

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\n📁 Collections in database:");
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });

    console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("\n🌐 Your APIs are ready to test:");
    console.log("=====================================");
    console.log("DOCTORS:");
    console.log("   GET    http://localhost:3000/src/doctors/get");
    console.log("   POST   http://localhost:3000/src/doctors/create");
    console.log("   GET    http://localhost:3000/src/doctors/:id");
    console.log("   PUT    http://localhost:3000/src/doctors/:id");
    console.log("   DELETE http://localhost:3000/src/doctors/:id");
    
    console.log("\nPATIENTS:");
    console.log("   GET    http://localhost:3000/src/patients/get");
    console.log("   POST   http://localhost:3000/src/patients/create");
    
    console.log("\nAPPOINTMENTS:");
    console.log("   GET    http://localhost:3000/src/appointments/get");
    console.log("   POST   http://localhost:3000/src/appointments/create");
    console.log("   GET    http://localhost:3000/src/appointments/:id");
    console.log("   PUT    http://localhost:3000/src/appointments/:id");
    console.log("   PATCH  http://localhost:3000/src/appointments/:id/cancel");
    console.log("   GET    http://localhost:3000/src/appointments/doctor/:doctorId");
    console.log("   GET    http://localhost:3000/src/appointments/patient/:patientId");
    
    console.log("\nTREATMENTS:");
    console.log("   GET    http://localhost:3000/src/treatments/get");
    console.log("   POST   http://localhost:3000/src/treatments/create");
    console.log("   GET    http://localhost:3000/src/treatments/:id");
    console.log("   PUT    http://localhost:3000/src/treatments/:id");
    console.log("   DELETE http://localhost:3000/src/treatments/:id");
    console.log("   GET    http://localhost:3000/src/treatments/patient/:patientId");
    console.log("   GET    http://localhost:3000/src/treatments/doctor/:doctorId");
    console.log("   GET    http://localhost:3000/src/treatments/stats/overview");

    console.log("\n📝 Sample IDs for testing:");
    console.log(`   Doctor ID: ${savedDoctor1._id}`);
    console.log(`   Patient ID: ${savedPatient1._id}`);
    console.log(`   Appointment ID: ${savedAppointment1._id}`);
    console.log(`   Treatment ID: ${savedTreatment1._id}`);

  } catch (error) {
    console.error("❌ Error occurred:");
    console.error(`   Type: ${error.name}`);
    console.error(`   Message: ${error.message}`);
  } finally {
    await mongoose.disconnect();
    console.log("\n📝 Database connection closed");
  }
}

testAllAPIs();