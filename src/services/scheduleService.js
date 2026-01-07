const Schedule = require('../models/schedule');
const Doctor = require('../models/doctor');

/**
 * Tạo các time slots mặc định cho một ngày
 * Sáng: 08:00 - 12:00, Chiều: 13:00 - 17:00
 * Mỗi slot 30 phút
 */
function generateDefaultTimeSlots() {
  const slots = [];
  
  // Helper function để format giờ thành 2 chữ số
  const formatHour = (hour) => hour.toString().padStart(2, '0');
  
  // Ca sáng: 08:00 - 12:00
  for (let hour = 8; hour < 12; hour++) {
    const currentHour = formatHour(hour);
    const nextHour = formatHour(hour + 1);
    slots.push({ startTime: `${currentHour}:00`, endTime: `${currentHour}:30`, isBooked: false });
    slots.push({ startTime: `${currentHour}:30`, endTime: `${nextHour}:00`, isBooked: false });
  }
  
  // Ca chiều: 13:00 - 17:00
  for (let hour = 13; hour < 17; hour++) {
    const currentHour = formatHour(hour);
    const nextHour = formatHour(hour + 1);
    slots.push({ startTime: `${currentHour}:00`, endTime: `${currentHour}:30`, isBooked: false });
    slots.push({ startTime: `${currentHour}:30`, endTime: `${nextHour}:00`, isBooked: false });
  }
  
  return slots;
}

/**
 * Tạo lịch cho tất cả bác sĩ cho một ngày cụ thể
 * @param {Date} date - Ngày cần tạo lịch
 * @param {Number} daysAhead - Số ngày tạo trước (mặc định 7 ngày)
 */
async function createSchedulesForAllDoctors(date = new Date(), daysAhead = 7) {
  try {
    console.log(`[Schedule Service] Bắt đầu tạo lịch cho ${daysAhead} ngày tiếp theo...`);
    
    // Lấy tất cả bác sĩ
    const doctors = await Doctor.find({});
    
    if (doctors.length === 0) {
      console.log('[Schedule Service] Không có bác sĩ nào trong hệ thống');
      return { success: true, message: 'No doctors found', created: 0 };
    }
    
    let totalCreated = 0;
    let totalSkipped = 0;
    
    // Tạo lịch cho N ngày tiếp theo
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      // Tạo date UTC đúng format như trong DB: 2025-11-08T00:00:00.000+00:00
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      targetDate.setUTCHours(0, 0, 0, 0); // Set về 00:00:00 UTC
      
      // Bỏ qua chủ nhật (getUTCDay() === 0 là Chủ nhật)
      // Tháng 1/2026: Chủ nhật là các ngày 11, 18, 25 (theo UTC)
      if (targetDate.getUTCDay() === 0) {
        const dateStr = targetDate.toISOString().split('T')[0];
        console.log(`[Schedule Service] Bỏ qua ngày ${dateStr} (Chủ nhật)`);
        continue;
      }
      
      // Tạo lịch cho từng bác sĩ
      for (const doctor of doctors) {
        try {
          // Kiểm tra xem lịch đã tồn tại chưa (so sánh theo ngày)
          const startOfDay = new Date(targetDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(targetDate);
          endOfDay.setHours(23, 59, 59, 999);
          
          const existingSchedule = await Schedule.findOne({
            doctor_id: doctor._id,
            date: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          });
          
          if (existingSchedule) {
            totalSkipped++;
            continue;
          }
          
          // Tạo lịch mới
          const newSchedule = new Schedule({
            doctor_id: doctor._id,
            date: targetDate,
            timeSlots: generateDefaultTimeSlots()
          });
          
          await newSchedule.save();
          totalCreated++;
          
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key error - lịch đã tồn tại
            totalSkipped++;
          } else {
            console.error(`[Schedule Service] Lỗi tạo lịch cho bác sĩ ${doctor.name}:`, error.message);
          }
        }
      }
    }
    
    console.log(`[Schedule Service] Hoàn thành! Đã tạo: ${totalCreated}, Bỏ qua: ${totalSkipped}`);
    
    return {
      success: true,
      message: `Created ${totalCreated} schedules, skipped ${totalSkipped} existing schedules`,
      created: totalCreated,
      skipped: totalSkipped
    };
    
  } catch (error) {
    console.error('[Schedule Service] Lỗi tạo lịch:', error);
    return {
      success: false,
      message: error.message,
      created: 0
    };
  }
}

/**
 * Xóa các lịch cũ (quá 30 ngày)
 */
async function cleanupOldSchedules() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await Schedule.deleteMany({
      date: { $lt: thirtyDaysAgo }
    });
    
    console.log(`[Schedule Service] Đã xóa ${result.deletedCount} lịch cũ`);
    return result.deletedCount;
    
  } catch (error) {
    console.error('[Schedule Service] Lỗi xóa lịch cũ:', error);
    return 0;
  }
}

/**
 * Xóa các lịch mới được tạo trong X phút gần đây
 * @param {Number} minutesAgo - Số phút (mặc định 10 phút)
 */
async function deleteRecentSchedules(minutesAgo = 10) {
  try {
    const timeThreshold = new Date();
    timeThreshold.setMinutes(timeThreshold.getMinutes() - minutesAgo);
    
    const result = await Schedule.deleteMany({
      createdAt: { $gte: timeThreshold }
    });
    
    console.log(`[Schedule Service] Đã xóa ${result.deletedCount} lịch được tạo trong ${minutesAgo} phút gần đây`);
    return result.deletedCount;
    
  } catch (error) {
    console.error('[Schedule Service] Lỗi xóa lịch mới:', error);
    return 0;
  }
}

module.exports = {
  generateDefaultTimeSlots,
  createSchedulesForAllDoctors,
  cleanupOldSchedules,
  deleteRecentSchedules
};
