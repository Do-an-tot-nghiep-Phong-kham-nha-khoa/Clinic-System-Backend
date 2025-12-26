const mongoose = require("mongoose");
const ChatMessage = require("../models/chatMessage");
const Specialty = require("../models/specialty");
const { generateFromGemini } = require("../services/geminiService");

/* =========================
   Helpers
========================= */

// Tạo slug/code ổn định từ name (không dấu)
function slugify(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

// Redact PHI cơ bản (tuỳ chỉnh thêm nếu cần)
function redactPHI(text) {
  if (!text) return text;
  return text.replace(/\b\d{9,}\b/g, "[REDACTED]");
}

// System prompt cố định (luật + format)
function buildSystemPrompt() {
  return `
Bạn là **Trợ lý Tư vấn Y tế của Bệnh viện** (tiếng Việt).

🎯 NHIỆM VỤ:
- Tư vấn sức khỏe ban đầu dựa trên mô tả của bệnh nhân
- Hướng dẫn xử trí an toàn, đúng y khoa
- GỢI Ý **CHUYÊN KHOA PHÙ HỢP** trong bệnh viện để bệnh nhân đi khám

🚫 QUY ĐỊNH BẮT BUỘC:
- ❌ KHÔNG chẩn đoán bệnh
- ❌ KHÔNG kê đơn thuốc
- ❌ KHÔNG kết luận chắc chắn
- ✅ Chỉ tư vấn chăm sóc ban đầu & hướng dẫn đi khám
- ⚠️ Nếu có dấu hiệu nguy hiểm (khó thở, đau ngực dữ dội, ngất, yếu liệt, nói khó, co giật, chảy máu nhiều không cầm, lơ mơ, sốt cao kéo dài)
  → YÊU CẦU ĐI CẤP CỨU NGAY / GỌI 115

📌 CHUYÊN KHOA:
- BẮT BUỘC chọn **CHÍNH XÁC 1 chuyên khoa** trong DANH SÁCH CUNG CẤP
- KHÔNG được tự tạo hoặc suy đoán thêm chuyên khoa khác
- Trả về **code + name đúng như danh sách**

📌 FORMAT TRẢ LỜI (KHÔNG ĐƯỢC THAY ĐỔI):
1️⃣ Mức độ: Khẩn cấp | Cần đi khám sớm | Có thể theo dõi

2️⃣ Nên làm ngay:
- Tối đa 3 gạch đầu dòng
- Ngắn gọn, rõ ràng, đúng y khoa

3️⃣ Chuyên khoa đề xuất bệnh nhân khám:
- Ghi theo mẫu:
  <Tên chuyên khoa> (<Mô tả chuyên khoa>)
- Tên chuyên khoa và mô tả PHẢI khớp chính xác với DANH SÁCH CHUYÊN KHOA ĐƯỢC CUNG CẤP
- KHÔNG hiển thị code, KHÔNG dùng bullet list

4️⃣ Hỏi nhanh:
- Tối đa 3 câu
- Chỉ hỏi thông tin cần thiết để hỗ trợ tốt hơn

🗣️ Văn phong: ngắn gọn, rõ ràng, như nhân viên y tế
`;
}

/* =========================
   Controller
========================= */

exports.chatWithBot = async (req, res) => {
  try {
    const { message, conversationId } = req.body || {};
    const user = req.user || null;
    const patientId = user?.id || null;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    const convId =
      conversationId || new mongoose.Types.ObjectId().toString();

    /* =========================
       1. Lưu message user
    ========================= */

    const safeContent = redactPHI(message);

    await ChatMessage.create({
      patientId,
      conversationId: convId,
      role: "user",
      content: safeContent,
      timestamp: new Date()
    });

    /* =========================
       2. Lấy lịch sử chat (giới hạn)
    ========================= */

    const historyDocs = await ChatMessage.find({
      conversationId: convId
    })
      .sort({ timestamp: 1 })
      .limit(10)
      .lean();

    const historyPrompt = historyDocs
      .map(m =>
        `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`
      )
      .join("\n");

    /* =========================
       3. Lấy specialty từ DB
    ========================= */

    const specialtiesRaw = await Specialty.find(
      {},
      { _id: 1, name: 1, description: 1 }
    ).lean();

    if (!specialtiesRaw.length) {
      return res.status(500).json({
        success: false,
        message: "No specialties found in system"
      });
    }

    const specialties = specialtiesRaw.map(s => ({
      id: s._id.toString(),
      code: slugify(s.name),
      name: s.name,
      description: s.description || ""
    }));

    const specialtyPrompt = specialties
      .map(
        s =>
          `- ${s.code} | ${s.name}: ${s.description}`
      )
      .join("\n");

    /* =========================
       4. Build prompt hoàn chỉnh
    ========================= */

    const systemPrompt = buildSystemPrompt();

    const finalPrompt = `
${systemPrompt}

=== DANH SÁCH CHUYÊN KHOA TRONG HỆ THỐNG ===
${specialtyPrompt}

=== LỊCH SỬ TRAO ĐỔI ===
${historyPrompt}

=== NGƯỜI BỆNH HIỆN TẠI ===
${safeContent}

Assistant:
`;

    /* =========================
       5. Gọi Gemini
    ========================= */

    let geminiResp;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        geminiResp = await generateFromGemini(finalPrompt, {
          maxOutputTokens: 700,
          temperature: 0.2
        });
        break;
      } catch (err) {
        const isRateLimit =
          err?.code === 429 ||
          err?.status === 429 ||
          err?.message?.toLowerCase().includes("rate");

        if (isRateLimit && attempt < maxRetries) {
          await new Promise(r =>
            setTimeout(r, Math.pow(2, attempt) * 500)
          );
          continue;
        }

        console.error("Gemini error:", err);
        return res.status(502).json({
          success: false,
          message: "AI service error"
        });
      }
    }

    const assistantText =
      geminiResp?.text ||
      "Xin lỗi, hiện không thể trả lời. Vui lòng thử lại sau.";

    /* =========================
       6. Lưu phản hồi assistant
    ========================= */

    await ChatMessage.create({
      patientId,
      conversationId: convId,
      role: "assistant",
      content: assistantText,
      metadata: {
        model: "gemini"
      },
      timestamp: new Date()
    });

    /* =========================
       7. Trả kết quả
    ========================= */

    return res.json({
      success: true,
      conversationId: convId,
      message: assistantText
    });
  } catch (error) {
    console.error("Chatbot controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Chatbot internal error"
    });
  }
};
