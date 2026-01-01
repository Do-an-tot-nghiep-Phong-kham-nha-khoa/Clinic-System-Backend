const mongoose = require("mongoose");
const ChatMessage = require("../models/chatMessage");
const Specialty = require("../models/specialty");
const { generateFromGemini } = require("../services/geminiService");

/* =========================
   Helpers
========================= */

function slugify(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function redactPHI(text) {
  if (!text) return text;
  return text.replace(/\b\d{9,}\b/g, "[REDACTED]");
}

function buildSystemPrompt() {
  return `
Bạn là trợ lý tư vấn y tế của bệnh viện.

Quy tắc bắt buộc:
- Không chẩn đoán bệnh
- Không kê đơn thuốc
- Không kết luận chắc chắn
- Chỉ tư vấn chăm sóc ban đầu
- Nếu có dấu hiệu nguy hiểm → yêu cầu đi cấp cứu ngay

Yêu cầu:
- Chọn CHÍNH XÁC 1 chuyên khoa từ danh sách được cung cấp
- Không tự tạo chuyên khoa
- Trả lời đúng format sau:

1️⃣ Mức độ: Khẩn cấp | Cần đi khám sớm | Có thể theo dõi

2️⃣ Nên làm ngay:
- Tối đa 3 ý

3️⃣ Chuyên khoa đề xuất bệnh nhân khám:
<Tên chuyên khoa> (<Mô tả chuyên khoa>)

4️⃣ Hỏi nhanh:
- Tối đa 3 câu
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
        message: "Message is required",
      });
    }

    const convId =
      conversationId || new mongoose.Types.ObjectId().toString();

    const safeContent = redactPHI(message);

    /* =========================
       1. Lưu message user
    ========================= */

    await ChatMessage.create({
      patientId,
      conversationId: convId,
      role: "user",
      content: safeContent,
      timestamp: new Date(),
    });

    /* =========================
       2. Lấy danh sách chuyên khoa (gọn)
    ========================= */

    const specialtiesRaw = await Specialty.find(
      {},
      { _id: 1, name: 1, description: 1 }
    ).lean();

    if (!specialtiesRaw.length) {
      return res.status(500).json({
        success: false,
        message: "No specialties found in system",
      });
    }

    const specialties = specialtiesRaw.map((s) => ({
      code: slugify(s.name),
      name: s.name,
      description: s.description || "",
    }));

    const specialtyPrompt = specialties
      .map((s) => `- ${s.code}: ${s.name}`)
      .join("\n");

    /* =========================
       3. Build prompt (tối ưu)
    ========================= */

    const finalPrompt = `
${buildSystemPrompt()}

Danh sách chuyên khoa:
${specialtyPrompt}

Triệu chứng người bệnh:
${safeContent}

Trả lời đúng format.
`;

    /* =========================
       4. Gọi Gemini
    ========================= */

    let geminiResp;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        geminiResp = await generateFromGemini(finalPrompt, {
          maxOutputTokens: 700,
          temperature: 0.2,
        });
        break;
      } catch (err) {
        const isRateLimit =
          err?.code === 429 ||
          err?.status === 429 ||
          err?.message?.toLowerCase().includes("rate");

        if (isRateLimit && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
          continue;
        }

        console.error("Gemini error:", err);
        return res.status(502).json({
          success: false,
          message: "AI service error",
        });
      }
    }

    const assistantText =
      geminiResp?.text ||
      "Xin lỗi, hiện không thể trả lời. Vui lòng thử lại sau.";

    /* =========================
       5. Lưu phản hồi assistant
    ========================= */

    await ChatMessage.create({
      patientId,
      conversationId: convId,
      role: "assistant",
      content: assistantText,
      metadata: {
        model: "gemini",
      },
      timestamp: new Date(),
    });

    /* =========================
       6. Trả kết quả
    ========================= */

    return res.json({
      success: true,
      conversationId: convId,
      message: assistantText,
    });
  } catch (error) {
    console.error("Chatbot controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Chatbot internal error",
    });
  }
};
