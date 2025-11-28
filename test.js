// scripts/testGeminiAPI.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiBasic() {
  console.log('=== Test Gemini API Basic ===\n');

  // Kiểm tra API key
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env file');
    console.log('Please add: GEMINI_API_KEY=your_api_key_here');
    return;
  }

  console.log('✅ API Key found');
  console.log('Key length:', apiKey.length);
  console.log('Key prefix:', apiKey.substring(0, 10) + '...\n');

  try {
    // Khởi tạo Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Chọn model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log('Sending test message to Gemini...\n');

    // Gửi message đơn giản
    const prompt = "Hello! Please respond with a simple greeting in Vietnamese.";
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ SUCCESS!\n');
    console.log('Gemini Response:');
    console.log('─'.repeat(50));
    console.log(text);
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('Message:', error.message);
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('\n💡 Solution: API key không hợp lệ');
      console.error('   - Kiểm tra lại API key tại: https://makersuite.google.com/app/apikey');
      console.error('   - Tạo API key mới nếu cần');
    }
    
    if (error.message.includes('quota')) {
      console.error('\n💡 Solution: Đã hết quota miễn phí');
      console.error('   - Chờ reset quota (thường reset hàng ngày)');
      console.error('   - Hoặc nâng cấp plan');
    }
  }
}

// Test với chat conversation
async function testGeminiChat() {
  console.log('\n\n=== Test Gemini Chat Conversation ===\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Bắt đầu chat
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "Xin chào! Tôi là bệnh nhân cần tư vấn." }],
        },
        {
          role: "model",
          parts: [{ text: "Xin chào! Tôi là trợ lý y tế ảo. Tôi có thể giúp gì cho bạn?" }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    console.log('Chat History initialized\n');

    // Gửi message mới
    const message = "Tôi bị đau đầu và sốt nhẹ. Nên làm gì?";
    console.log('User:', message, '\n');

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    console.log('Assistant:', text);
    console.log('\n✅ Chat conversation works!');

  } catch (error) {
    console.error('❌ Chat test failed:', error.message);
  }
}

// Main
async function main() {
  await testGeminiBasic();
  await testGeminiChat();
  
  console.log('\n' + '='.repeat(50));
  console.log('Test completed!');
  console.log('='.repeat(50));
}

main();