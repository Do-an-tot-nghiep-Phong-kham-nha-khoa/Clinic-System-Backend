const cron = require('node-cron');
const { createSchedulesForAllDoctors, cleanupOldSchedules } = require('../services/scheduleService');

/**
 * Khởi động các scheduled jobs
 */
function initScheduledJobs() {
  
  // ============================================
  // JOB 1: Tạo lịch mới mỗi ngày lúc 00:01
  // ============================================
  cron.schedule('1 0 * * *', async () => {
    const now = new Date();
    
    try {
      // Tạo lịch cho 7 ngày tiếp theo
      const result = await createSchedulesForAllDoctors(now, 7);
      console.log('[Cron Job] Kết quả:', result);
    } catch (error) {
      console.error('[Cron Job] Lỗi:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });
  
  // ============================================
  // JOB 2: Dọn dẹp lịch cũ mỗi tuần (chủ nhật lúc 2:00)
  // ============================================
  cron.schedule('0 2 * * 0', async () => {
    console.log('\n[Cron Job] Bắt đầu dọn dẹp lịch cũ...');
    
    try {
      const deletedCount = await cleanupOldSchedules();
      console.log(`[Cron Job] Đã xóa ${deletedCount} lịch cũ`);
    } catch (error) {
      console.error('[Cron Job] Lỗi khi dọn dẹp:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });
  
  // ============================================
  // JOB 3: Tạo lịch ngay khi server khởi động (ĐÃ TẮT)
  // ============================================
  // UNCOMMENT đoạn này nếu muốn tự động tạo lịch khi server khởi động
  /*
  setTimeout(async () => {
    console.log('\n[Startup] Tạo lịch ban đầu khi server khởi động...');
    try {
      const result = await createSchedulesForAllDoctors(new Date(), 14); // Tạo 14 ngày
      console.log('[Startup] Kết quả:', result);
    } catch (error) {
      console.error('[Startup] Lỗi:', error);
    }
  }, 5000); // Chờ 5 giây sau khi server khởi động
  */
  
}

module.exports = { initScheduledJobs };
