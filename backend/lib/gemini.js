const axios = require('axios');

const SARVAM_URL = 'https://api.sarvam.ai/v1/chat/completions';
const HEADERS = {
  'api-subscription-key': process.env.SARVAM_API_KEY,
  'Content-Type': 'application/json',
};

async function generateJSON(prompt) {
  const fullPrompt = prompt + '\n\nRespond ONLY with valid JSON. No markdown, no backticks, no preamble.';

  const res = await axios.post(SARVAM_URL, {
    model: 'sarvam-30b',
    messages: [{ role: 'user', content: fullPrompt }],
    temperature: 0.2,
  }, { headers: HEADERS });

  let raw = res.data.choices[0].message.content.trim();
  raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Failed to parse JSON from Sarvam response: ' + raw);
  }
}

async function generateText(systemPrompt, userMessage, conversationHistory = []) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await axios.post(SARVAM_URL, {
    model: 'sarvam-30b',
    messages,
    temperature: 0.7,
  }, { headers: HEADERS });

  return res.data.choices[0].message.content;
}

module.exports = { generateJSON, generateText };
