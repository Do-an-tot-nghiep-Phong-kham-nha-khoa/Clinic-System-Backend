const mongoose = require('mongoose');
const Appointment = require('../src/models/appointment');
const { 
  createPatientSnapshot, 
  createDoctorSnapshot, 
  createSpecialtySnapshot 
} = require('../src/helpers/appointmentSnapshot');

/**
 * Script migration để thêm snapshots cho appointments đã tồn tại
 * Chạy một lần để cập nhật dữ liệu cũ
 */

async function migrateAppointmentSnapshots() {
  try {
    console.log('🚀 Bắt đầu migration appointment snapshots...\n');

    // Connect to MongoDB
    const dbConfig = require('../config/database');
    await mongoose.connect(dbConfig.uri, dbConfig.options);
    console.log('✅ Kết nối database thành công\n');

    // Tìm tất cả appointments chưa có snapshot
    const appointmentsWithoutSnapshot = await Appointment.find({
      $or: [
        { patientSnapshot: { $exists: false } },
        { doctorSnapshot: { $exists: false } },
        { specialtySnapshot: { $exists: false } }
      ]
    });

    console.log(`📊 Tìm thấy ${appointmentsWithoutSnapshot.length} appointments cần cập nhật\n`);

    if (appointmentsWithoutSnapshot.length === 0) {
      console.log('✨ Không có appointments nào cần migration!');
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    // Process appointments in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < appointmentsWithoutSnapshot.length; i += BATCH_SIZE) {
      const batch = appointmentsWithoutSnapshot.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 Xử lý batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(appointmentsWithoutSnapshot.length / BATCH_SIZE)}`);

      const promises = batch.map(async (appointment) => {
        try {
          const updates = {};

          // Tạo patient snapshot nếu chưa có
          if (!appointment.patientSnapshot && appointment.healthProfile_id) {
            const patientSnapshot = await createPatientSnapshot(appointment.healthProfile_id);
            if (patientSnapshot) {
              updates.patientSnapshot = patientSnapshot;
            }
          }

          // Tạo doctor snapshot nếu chưa có và đã có doctor
          if (!appointment.doctorSnapshot && appointment.doctor_id) {
            const doctorSnapshot = await createDoctorSnapshot(appointment.doctor_id);
            if (doctorSnapshot) {
              updates.doctorSnapshot = doctorSnapshot;
            }
          }

          // Tạo specialty snapshot nếu chưa có
          if (!appointment.specialtySnapshot && appointment.specialty_id) {
            const specialtySnapshot = await createSpecialtySnapshot(appointment.specialty_id);
            if (specialtySnapshot) {
              updates.specialtySnapshot = specialtySnapshot;
            }
          }

          // Update appointment nếu có snapshot mới
          if (Object.keys(updates).length > 0) {
            await Appointment.findByIdAndUpdate(appointment._id, updates);
            successCount++;
            return { success: true, id: appointment._id };
          }

          return { success: true, id: appointment._id, skipped: true };
        } catch (error) {
          errorCount++;
          console.error(`❌ Lỗi khi xử lý appointment ${appointment._id}:`, error.message);
          return { success: false, id: appointment._id, error: error.message };
        }
      });

      await Promise.all(promises);
      console.log(`   ✓ Hoàn thành batch ${Math.floor(i / BATCH_SIZE) + 1}\n`);
    }

    console.log('\n📈 Kết quả migration:');
    console.log(`   ✅ Thành công: ${successCount}`);
    console.log(`   ❌ Lỗi: ${errorCount}`);
    console.log(`   📝 Tổng cộng: ${appointmentsWithoutSnapshot.length}\n`);

    console.log('🎉 Migration hoàn tất!');
    process.exit(0);

  } catch (error) {
    console.error('💥 Lỗi nghiêm trọng:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateAppointmentSnapshots();
}

module.exports = migrateAppointmentSnapshots;
