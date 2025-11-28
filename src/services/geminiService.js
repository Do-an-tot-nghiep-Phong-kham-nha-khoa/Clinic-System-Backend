// services/gemini.service.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

module.exports.generateFromGemini = async function(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_MISSING");

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    const promptObj = [
      { role: "user", content: prompt }   // hoặc dùng parts nếu cần
    ];

    // Some versions of the SDK expect different request shapes. Try several formats.
    const attempts = [
      // SDK often expects either an array of parts or a plain string
      promptObj,
      prompt,
      { prompt: promptObj },
      { prompt: { text: prompt } },
      { prompt: prompt },
      { input: prompt },
      { prompt: [{ content: prompt }] }
    ];

    let lastErr = null;
    for (const reqBody of attempts) {
      try {
        const result = await model.generateContent(reqBody);
        const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        return { text, raw: result };
      } catch (err) {
        lastErr = err;
        // If error message suggests un-iterable request, try next format
        console.warn('Gemini attempt failed for request shape', reqBody, 'error:', err?.message || err);
        continue;
      }
    }

    // If none of the formats worked, throw the last error
    console.error('All Gemini request formats failed. Last error:', lastErr);
    if (lastErr instanceof Error) throw lastErr;
    const e = new Error('GEMINI_SERVICE_ERROR');
    e.code = 'GEMINI_SERVICE_ERROR';
    e.original = lastErr;
    throw e;
  } catch (err) {
    console.error("Gemini SDK raw error:", err);  // <-- log chi tiết
    console.error("Gemini service error:", err?.response || err?.message || err);
    // rethrow the original error so caller can decide how to handle it
    if (err instanceof Error) throw err;
    const e = new Error('GEMINI_SERVICE_ERROR');
    e.code = 'GEMINI_SERVICE_ERROR';
    e.original = err;
    throw e;
  }
}
