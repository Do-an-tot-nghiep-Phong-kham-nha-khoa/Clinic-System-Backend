/**
 * Migration script để thêm patientSnapshot vào các appointments hiện có
 * Chạy: node scripts/migrate-appointment-snapshots.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Appointment = require('../src/models/appointment');
const { createPatientSnapshot } = require('../src/helpers/snapshot');

async function migrateAppointmentSnapshots() {
    try {
        // Kết nối database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-system', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB');

        // Tìm tất cả appointments chưa có snapshot
        const appointments = await Appointment.find({
            $or: [
                { patientSnapshot: { $exists: false } },
                { patientSnapshot: null }
            ]
        });

        console.log(`📊 Found ${appointments.length} appointments without snapshot`);

        if (appointments.length === 0) {
            console.log('✅ All appointments already have snapshots!');
            process.exit(0);
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Migrate từng appointment
        for (let i = 0; i < appointments.length; i++) {
            const apt = appointments[i];
            
            try {
                console.log(`Processing ${i + 1}/${appointments.length}: ${apt._id}`);

                // Tạo snapshot
                const snapshot = await createPatientSnapshot(apt.healthProfile_id);

                if (snapshot) {
                    // Cập nhật appointment
                    apt.patientSnapshot = snapshot;
                    await apt.save();
                    successCount++;
                    console.log(`  ✅ Success: ${snapshot.name}`);
                } else {
                    errorCount++;
                    errors.push({
                        appointmentId: apt._id,
                        reason: 'Failed to create snapshot - healthProfile not found'
                    });
                    console.log(`  ⚠️  Warning: Could not create snapshot`);
                }
            } catch (error) {
                errorCount++;
                errors.push({
                    appointmentId: apt._id,
                    reason: error.message
                });
                console.error(`  ❌ Error: ${error.message}`);
            }
        }

        // Kết quả
        console.log('\n📊 Migration Summary:');
        console.log(`   Total appointments: ${appointments.length}`);
        console.log(`   ✅ Successfully migrated: ${successCount}`);
        console.log(`   ❌ Failed: ${errorCount}`);

        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(err => {
                console.log(`   - Appointment ${err.appointmentId}: ${err.reason}`);
            });
        }

        console.log('\n✅ Migration completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Chạy migration
migrateAppointmentSnapshots();
