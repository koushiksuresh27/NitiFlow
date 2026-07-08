const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech');
const { generateJSON } = require('../lib/gemini');
const { createClient } = require('@supabase/supabase-js');
const { runDNAPipeline } = require('../lib/dna');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const supabaseAdmin = require('../lib/supabase');

// Initialize Google Cloud Speech Client
const speechClient = new SpeechClient();

// POST /api/voice/submit
router.post('/submit', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    const { ward_id } = req.body;

    // ==========================================
    // STEP 1: Google Cloud Speech-to-Text
    // ==========================================
    const audioBytes = fs.readFileSync(req.file.path).toString('base64');
    
    const request = {
      audio: {
        content: audioBytes,
      },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'hi-IN',
        alternativeLanguageCodes: ['kn-IN', 'ta-IN', 'te-IN', 'ml-IN', 'en-IN'],
        enableAutomaticPunctuation: true,
        model: 'latest_long'
      },
    };

    const [response] = await speechClient.recognize(request);
    
    // Clean up temp file
    fs.unlinkSync(req.file.path);

    const transcript = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
      
    // Extract detected language if available, else default to hi-IN
    const detectedLanguage = response.results[0]?.languageCode || 'hi-IN';

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
