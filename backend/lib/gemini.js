const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Calls Gemini and returns parsed JSON.
 * @param {string} prompt 
 * @returns {object} Parsed JSON object
 */
async function generateJSON(prompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.2,
    }
  });

  const fullPrompt = `${prompt}\nRespond ONLY with valid JSON. No markdown, no backticks, no preamble.`;
  
  try {
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();
    
    // Strip any ```json fences from response
    const cleanText = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
      
    return JSON.parse(cleanText);
  } catch (error) {
    throw new Error(`Failed to generate or parse JSON from Gemini: ${error.message}`);
  }
}

/**
 * Starts a chat with Gemini and returns text response.
 * @param {string} systemPrompt 
 * @param {string} userMessage 
 * @param {Array<{role: string, content: string}>} conversationHistory 
 * @returns {string} Response text
 */
async function generateText(systemPrompt, userMessage, conversationHistory = []) {
  // Use systemInstruction for the system prompt
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
    }
  });

  // Convert generic {role, content} history to Gemini's format
  const history = conversationHistory.map(msg => {
    // Map standard 'assistant' role to Gemini's 'model' role
    const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
    return {
      role: role,
      parts: [{ text: msg.content }]
    };
  });

  try {
    const chat = model.startChat({
      history: history
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    throw new Error(`Failed to generate text from Gemini: ${error.message}`);
  }
}

module.exports = {
  generateJSON,
  generateText
};
