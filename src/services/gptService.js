// services/gptService.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.generateFromGPT = async function (prompt, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error("OPENAI_API_KEY_MISSING");
    err.code = "OPENAI_API_KEY_MISSING";
    throw err;
  }

  try {
    const response = await openai.chat.completions.create({
      model: options.model || "gpt-3.5-turbo",
      messages: [
        { role: "user", content: prompt }
      ],
      max_tokens: options.maxTokens || 200,
      temperature: options.temperature || 0.7,
    });

    const text = response.choices[0].message.content.trim();
    return { text, raw: response };
  } catch (err) {
    console.error("GPT service error:", err?.message || err);

    if (err?.status === 429) {
      const quotaErr = new Error("OPENAI_QUOTA_EXCEEDED");
      quotaErr.code = "OPENAI_QUOTA_EXCEEDED";
      throw quotaErr;
    }

    if (err?.status === 401) {
      const keyErr = new Error("OPENAI_API_KEY_INVALID");
      keyErr.code = "OPENAI_API_KEY_INVALID";
      throw keyErr;
    }

    throw err;
  }
};
