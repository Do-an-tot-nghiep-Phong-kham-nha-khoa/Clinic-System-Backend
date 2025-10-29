const axios = require("axios");
const axiosRetry = require("axios-retry");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 }); // cache 60s

axiosRetry(axios, {
    retries: 3, // thử lại 3 lần
    retryDelay: (retryCount) => retryCount * 1000, // mỗi lần chờ lâu hơn 1s
    retryCondition: (error) => {
        return error.response?.status === 429 || error.code === "ECONNABORTED";
    },
});

export async function getChatReply(userMessage) {
    const cached = cache.get(userMessage);
    if (cached) return cached;

    const url = "https://api.openai.com/v1/chat/completions";
    const headers = {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
    };
    const body = {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: userMessage }],
    };

    try {
        const res = await axios.post(url, body, { headers });
        const reply = res.data.choices[0].message.content;
        cache.set(userMessage, reply);
        return reply;
    } catch (err) {
        console.error("Chatbot API error:", err.message);
        return "Xin lỗi, hiện tại tôi đang quá tải. Vui lòng thử lại sau.";
    }
}
