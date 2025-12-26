// services/gemini.service.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

module.exports.generateFromGemini = async function(prompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error("GEMINI_API_KEY_MISSING");
    err.code = "GEMINI_API_KEY_MISSING";
    throw err;
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite",  // Model lite thường có quota cao hơn
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || 200,
      temperature: options.temperature || 0.1,
    }
  });

  try {
    // Gemini SDK expects a simple string for generateContent
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return { text, raw: result };
  } catch (err) {
    console.error("Gemini service error:", err?.message || err);
    
    // Handle specific error types
    if (err?.message?.includes("quota") || err?.message?.includes("429")) {
      const quotaErr = new Error("GEMINI_QUOTA_EXCEEDED");
      quotaErr.code = "GEMINI_QUOTA_EXCEEDED";
      quotaErr.original = err;
      throw quotaErr;
    }
    
    if (err?.message?.includes("API key")) {
      const keyErr = new Error("GEMINI_API_KEY_INVALID");
      keyErr.code = "GEMINI_API_KEY_INVALID";
      keyErr.original = err;
      throw keyErr;
    }
    
    // Generic service error
    if (err instanceof Error) throw err;
    const e = new Error('GEMINI_SERVICE_ERROR');
    e.code = 'GEMINI_SERVICE_ERROR';
    e.original = err;
    throw e;
  }
}
