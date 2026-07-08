const express = require('express');
const router = express.Router();
const { generateJSON } = require('../lib/gemini');
const supabaseAdmin = require('../lib/supabase');
const { runDNAPipeline } = require('../lib/dna');

// POST /api/complaints/text
router.post('/text', async (req, res) => {
  try {
    const { text, ward_id } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const prompt = `You are an AI assistant processing citizen complaints for an Indian 
constituency MP.

Analyze this complaint and extract structured data.

Transcript: ${text}

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

    const { data: complaint, error: insertError } = await supabaseAdmin
      .from('complaints')
      .insert({
        input_type: 'text',
        ward_id: ward_id || null,
        category: structuredData.category,
        urgency: structuredData.urgency,
        confidence: structuredData.confidence,
        summary: structuredData.summary,
        ward_hint: structuredData.ward_hint,
        sentiment_score: structuredData.sentiment_score,
        transcript: text,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // Call DNA pipeline asynchronously
    runDNAPipeline(complaint).catch(err => {
      console.error('Background DNA Pipeline Error:', err);
    });

    res.json({
      success: true,
      transcript: text,
      detectedLanguage: 'en', // default for text pipeline
      complaint: structuredData
    });

  } catch (err) {
    console.error('Text Complaint Pipeline Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
