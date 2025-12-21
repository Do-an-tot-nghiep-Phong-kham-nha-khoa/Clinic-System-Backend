// controllers/chatbotController.js
const mongoose = require("mongoose");
const ChatMessage = require("../models/chatMessage");
const { generateFromGemini } = require("../services/geminiService");

// helper for safe prompt building (redact PHI)
function buildSystemPrompt() {
  return `You are a healthcare assistant. Provide safe, conservative advice: general guidance on symptoms, appointment scheduling, and hospital services. 
Do NOT provide diagnoses. Always recommend seeing a doctor if symptoms are serious.`;
}

function redactPHI(text) {
  // rất cơ bản: remove digits that look like SSN/phone — tune theo yêu cầu
  return text.replace(/\b\d{9,}\b/g, "[REDACTED_ID]");
}

exports.chatWithBot = async (req, res) => {
  try {
    const { message, conversationId } = req.body || {};
    const user = req.user || null; // ensure auth middleware fills req.user
    const patientId = user?.id || null;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // conversationId: dùng provided hoặc tạo mới
    const convId = conversationId || new mongoose.Types.ObjectId().toString();

    // Save user message (redact before saving if policy requires)
    const safeContent = redactPHI(message);
    await ChatMessage.create({
      patientId,
      conversationId: convId,
      role: "user",
      content: safeContent,
      timestamp: new Date()
    });

    // Fetch recent history for context (only messages user is allowed to see)
    // Limit to last 10 messages for prompt length control
    const historyDocs = await ChatMessage.find({ conversationId: convId })
      .sort({ timestamp: 1 })
      .limit(20)
      .lean();

    // Build prompt: system + last N messages
    const systemPrompt = buildSystemPrompt();
    const historyPrompt = historyDocs.map(h => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`).join("\n");

    // Construct final prompt for Gemini — keep PHI minimal
    const prompt = `${systemPrompt}\n\nContext:\n${historyPrompt}\n\nUser: ${safeContent}\nAssistant:`;

    // Call Gemini with retry/backoff for transient errors
    let geminiResp;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        geminiResp = await generateFromGemini(prompt, { maxOutputTokens: 800, temperature: 0.2 });
        break;
      } catch (err) {
        const isTransient = err?.message?.toLowerCase().includes("rate") || err?.code === 429 || err?.status === 429;
        if (isTransient && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 500; // 500ms, 1000ms, ...
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        // Log detailed error
        console.error("Gemini final error:", err?.response?.data || err?.message || err);

        // Clearer client responses for common issues
        if (err && (err.code === 'GEMINI_API_KEY_MISSING' || err.message === 'GEMINI_API_KEY_MISSING')) {
          return res.status(500).json({ success: false, code: 'gemini_api_key_missing', message: 'GEMINI_API_KEY is not configured on the server.' });
        }

        if (err && (err.code === 'GEMINI_API_KEY_INVALID')) {
          return res.status(500).json({ success: false, code: 'gemini_api_key_invalid', message: 'GEMINI_API_KEY is invalid.' });
        }

        if (err && (err.code === 'GEMINI_QUOTA_EXCEEDED')) {
          return res.status(429).json({ success: false, code: 'gemini_quota_exceeded', message: 'Gemini API quota exceeded. Please try again later.' });
        }

        if (err && (err.code === 'GEMINI_SERVICE_ERROR' || err.message === 'GEMINI_SERVICE_ERROR')) {
          return res.status(502).json({ success: false, code: 'gemini_service_error', message: 'Gemini service returned an error.' });
        }

        // Generic error
        return res.status(500).json({ success: false, message: 'AI service error' });
      }
    }

    const assistantText = (geminiResp && geminiResp.text) ? geminiResp.text : "Xin lỗi, hiện không thể trả lời. Vui lòng thử lại sau.";

    // Save assistant response with metadata
    await ChatMessage.create({
      patientId,
      conversationId: convId,
      role: "assistant",
      content: assistantText,
      metadata: {
        model: "gemini-2.0-flash",
        // tokens & responseTime not available from SDK here; fill if SDK exposes usage info
      },
      timestamp: new Date()
    });

    // Return to client — always return convId
    return res.json({ success: true, message: assistantText, conversationId: convId });

  } catch (error) {
    console.error("Chatbot controller error:", error?.response?.data || error?.message || error);
    return res.status(500).json({ success: false, message: "Chatbot internal error" });
  }
};
