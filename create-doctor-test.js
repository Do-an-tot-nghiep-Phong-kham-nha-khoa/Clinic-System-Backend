// Simple script to test doctor creation via API
require("dotenv").config();
const mongoose = require("mongoose");
const Doctor = require("./src/models/doctor");

async function createDoctorDirectly() {
  try {
    // Connect to database
    console.log("🔗 Connecting to database...");
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected to database successfully!");
    
    // Check if any doctors exist
    const existingDoctors = await Doctor.find();
    console.log(`📊 Current doctors in database: ${existingDoctors.length}`);
    
    if (existingDoctors.length > 0) {
      console.log("📋 Existing doctors:");
      existingDoctors.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.name} - ${doc.email}`);
      });
    }

    // Create a new doctor
    console.log("\n🩺 Creating a new doctor...");
    const newDoctor = new Doctor({
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

    console.log("💾 Saving doctor to database...");
    const savedDoctor = await newDoctor.save();
    console.log("✅ Doctor saved successfully!");
    console.log(`   ID: ${savedDoctor._id}`);
    console.log(`   Name: ${savedDoctor.name}`);
    console.log(`   Email: ${savedDoctor.email}`);
    console.log(`   Expertise: ${savedDoctor.expertise.name}`);

    // Verify the save
    const allDoctors = await Doctor.find();
    console.log(`\n📊 Total doctors after creation: ${allDoctors.length}`);
    
    // List all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\n📁 Collections in database:");
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });

  } catch (error) {
    console.error("❌ Error occurred:");
    console.error(`   Type: ${error.name}`);
    console.error(`   Message: ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n📝 Database connection closed");
  }
}

createDoctorDirectly();