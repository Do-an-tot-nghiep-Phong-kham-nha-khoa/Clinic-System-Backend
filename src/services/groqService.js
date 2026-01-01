// services/groq.service.js
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

module.exports.generateFromGroq = async function (prompt, options = {}) {
  if (!process.env.GROQ_API_KEY) {
    const err = new Error("GROQ_API_KEY_MISSING");
    err.code = "GROQ_API_KEY_MISSING";
    throw err;
  }

  try {
    const completion = await client.chat.completions.create({
      model: options.model || "llama-3.3-70b-versatile", // Model miễn phí và mạnh nhất
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: options.maxOutputTokens || 700,
      temperature: options.temperature || 0.2,
      stream: false,
    });

    const text = completion.choices[0]?.message?.content || "";

    return { text, raw: completion };
  } catch (err) {
    console.error("Groq service error:", err?.message || err);

    // Handle specific error types
    if (err?.status === 429 || err?.message?.includes("rate limit")) {
      const quotaErr = new Error("GROQ_RATE_LIMIT_EXCEEDED");
      quotaErr.code = 429;
      quotaErr.status = 429;
      quotaErr.original = err;
      throw quotaErr;
    }

    if (
      err?.message?.includes("API key") ||
      err?.status === 401 ||
      err?.status === 403
    ) {
      const keyErr = new Error("GROQ_API_KEY_INVALID");
      keyErr.code = "GROQ_API_KEY_INVALID";
      keyErr.original = err;
      throw keyErr;
    }

    if (err?.status === 402 || err?.message?.includes("Insufficient")) {
      const balanceErr = new Error("GROQ_INSUFFICIENT_BALANCE");
      balanceErr.code = 402;
      balanceErr.status = 402;
      balanceErr.original = err;
      throw balanceErr;
    }

    // Generic service error
    if (err instanceof Error) throw err;
    const e = new Error("GROQ_SERVICE_ERROR");
    e.code = "GROQ_SERVICE_ERROR";
    e.original = err;
    throw e;
  }
};
