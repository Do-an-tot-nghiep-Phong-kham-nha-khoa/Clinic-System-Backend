// Test new database connection
require("dotenv").config();
const mongoose = require("mongoose");
const Doctor = require("./src/models/doctor");
const Patient = require("./src/models/patient");
const Appointment = require("./src/models/appointment");
const Treatment = require("./src/models/treatment");

async function testConnection() {
  try {
    console.log("🔗 Testing connection to database...");
    console.log(`📍 Database: ${process.env.MONGO_URL.split('/').pop().split('?')[0]}`);
    
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected successfully!\n");

    // Check existing data
    const doctorCount = await Doctor.countDocuments();
    const patientCount = await Patient.countDocuments();
    const appointmentCount = await Appointment.countDocuments();
    const treatmentCount = await Treatment.countDocuments();

    console.log("📊 Current data in database:");
    console.log(`   Doctors: ${doctorCount}`);
    console.log(`   Patients: ${patientCount}`);
    console.log(`   Appointments: ${appointmentCount}`);
    console.log(`   Treatments: ${treatmentCount}`);

    if (doctorCount === 0) {
      console.log("\n💡 No data found. Creating sample data...\n");
      
      // Create sample doctor
      const doctor = new Doctor({
        name: "Dr. John Smith",
        email: "john.smith@healthcare.com",
        phone: "+1234567890",
        gender: "Male",
        address: "123 Main Street",
        expertise: {
          name: "General Dentistry",
          description: "General dental care"
        }
      });
      await doctor.save();
      console.log(`✅ Created doctor: ${doctor.name} (ID: ${doctor._id})`);

      // Create sample patient
      const patient = new Patient({
        name: "Alice Johnson",
        phone: "+1111222333",
        email: "alice@email.com",
        address: "456 Oak Ave",
        dob: new Date("1990-05-15")
      });
      await patient.save();
      console.log(`✅ Created patient: ${patient.name} (ID: ${patient._id})`);

      // Create sample appointment
      const appointment = new Appointment({
        patient: patient._id,
        doctor: doctor._id,
        appointmentDate: new Date("2025-10-25"),
        appointmentTime: "10:00",
        treatmentType: "Consultation",
        notes: "Initial consultation"
      });
      await appointment.save();
      console.log(`✅ Created appointment: ${appointment.treatmentType} (ID: ${appointment._id})`);

      console.log("\n📝 Sample IDs for API testing:");
      console.log(`   Doctor ID: ${doctor._id}`);
      console.log(`   Patient ID: ${patient._id}`);
      console.log(`   Appointment ID: ${appointment._id}`);
    } else {
      console.log("\n✅ Database already has data!");
      
      const sampleDoctor = await Doctor.findOne();
      const samplePatient = await Patient.findOne();
      const sampleAppointment = await Appointment.findOne();
      
      if (sampleDoctor) console.log(`\n📝 Sample Doctor ID: ${sampleDoctor._id}`);
      if (samplePatient) console.log(`📝 Sample Patient ID: ${samplePatient._id}`);
      if (sampleAppointment) console.log(`📝 Sample Appointment ID: ${sampleAppointment._id}`);
    }

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\n📁 Collections in Healthcare database:");
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });

    console.log("\n🎉 Connection test successful!");
    console.log("\n🌐 API Endpoints:");
    console.log("   Doctors:      http://localhost:3000/src/doctors/get");
    console.log("   Patients:     http://localhost:3000/src/patients/get");
    console.log("   Appointments: http://localhost:3000/src/appointments/get");
    console.log("   Treatments:   http://localhost:3000/src/treatments/get");

  } catch (error) {
    console.error("❌ Connection failed!");
    console.error(`   Error: ${error.message}`);
  } finally {
    await mongoose.disconnect();
    console.log("\n📝 Connection closed");
  }
}

testConnection();