const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { generateJSON } = require('../lib/gemini');
const { createClient } = require('@supabase/supabase-js');
const { runDNAPipeline } = require('../lib/dna');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const supabaseAdmin = require('../lib/supabase');

async function transcribeWithSarvam(audioFilePath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioFilePath), {
    filename: 'audio.webm',
    contentType: 'audio/webm'
  });
  formData.append('model', 'saarika:v2.5');
  formData.append('language_code', 'unknown');

  const response = await axios.post(
    'https://api.sarvam.ai/speech-to-text',
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        'api-subscription-key': process.env.SARVAM_API_KEY
      }
    }
  );

  const transcript = response.data.transcript;
  const detectedLanguage = response.data.language_code || 'hi-IN';

  if (!transcript) {
    throw new Error('No speech detected. Please speak clearly and try again.');
  }

  return { transcript, detectedLanguage, confidence: 0.95 };
}

// POST /api/voice/submit
router.post('/submit', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    const { ward_id } = req.body;

    // ==========================================
    // STEP 1: Sarvam Speech-to-Text
    // ==========================================
    const { transcript, detectedLanguage } = await transcribeWithSarvam(req.file.path);
    
    // Clean up temp file
    fs.unlinkSync(req.file.path);

    if (!transcript?.trim()) {
      return res.status(400).json({ error: 'Could not transcribe audio' });
    }

    // ==========================================
    // STEP 2: Gemini Categorization
    // ==========================================
    const prompt = `You are an AI assistant processing citizen complaints for an Indian 
constituency MP.

Analyze this complaint and extract structured data.

Transcript: ${transcript}

// TODO: swap category enum for your project's categories
Return ONLY valid JSON:
{
  "category": one of ["roads","water_supply","schools","health","sanitation","electricity","street_lights","other"],
  "urgency": one of ["low","medium","high"],
  "confidence": float 0-1,
  "summary": one sentence under 15 words in English,
  "ward_hint": locality/area name mentioned or null,
  "sentiment_score": float 0-1 where 0 is very frustrated
}`;

    const structuredData = await generateJSON(prompt);

    // ==========================================
    // STEP 3: Insert into Complaints Table
    // ==========================================
    const { data: complaint, error: insertError } = await supabaseAdmin
      .from('complaints')
      .insert({
        input_type: 'voice',
        ward_id: ward_id || null,
        category: structuredData.category,
        urgency: structuredData.urgency,
        confidence: structuredData.confidence,
        summary: structuredData.summary,
        ward_hint: structuredData.ward_hint,
        sentiment_score: structuredData.sentiment_score,
        transcript: transcript,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // ==========================================
    // STEP 4: Call DNA Pipeline (Fire and Forget)
    // ==========================================
    runDNAPipeline(complaint).catch(err => {
      console.error('Background DNA Pipeline Error:', err);
    });

    // Return structured response
    res.json({
      success: true,
      transcript,
      detectedLanguage,
      complaint: structuredData
    });

  } catch (err) {
    console.error('Voice Pipeline Error:', err);
    // Ensure temp file is cleaned up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
