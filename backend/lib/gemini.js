const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateJSON(prompt) {
  const result = await model.generateContent(prompt + '\n\nRespond ONLY with valid JSON. No markdown, no backticks, no preamble.');
  const text = result.response.text();
  
  let raw = text.trim();
  raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Failed to parse JSON from Gemini response: ' + raw);
  }
}

async function generateText(systemPrompt, userMessage, conversationHistory = []) {
  // Map conversation history to Gemini's format
  const history = conversationHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood.' }] },
      ...history
    ]
  });

  const result = await chat.sendMessage([{ text: userMessage }]);
  return result.response.text();
}

module.exports = { generateJSON, generateText };
