const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { generateJSON } = require('../lib/gemini');
const supabase = require('../lib/supabase');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Initialize Sarvam async document extraction
async function extractPdfText(pdfBuffer) {
  const HEADERS = { 'api-subscription-key': process.env.SARVAM_API_KEY };

  // 1. Create the job
  const jobRes = await axios.post('https://api.sarvam.ai/doc-digitization/job/v1', {
    job_parameters: { language: 'en-IN', output_format: 'md' }
  }, { headers: HEADERS });

  const jobId = jobRes.data.job_id;
  const uploadUrl = jobRes.data.input_storage_path;

  // 2. Upload the PDF
  await axios.put(uploadUrl, pdfBuffer, { headers: { 'Content-Type': 'application/pdf' } });

  // 3. Trigger processing (Optional based on Sarvam API, assuming start is needed if they mentioned it)
  // await axios.post(`https://api.sarvam.ai/doc-digitization/job/v1/${jobId}/start`, {}, { headers: HEADERS });

  // 4. Poll until done
  let status = 'pending';
  let output;
  while (status !== 'completed') {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await axios.get(`https://api.sarvam.ai/doc-digitization/job/v1/${jobId}`, { headers: HEADERS });
    status = statusRes.data.status;
    if (status === 'completed') output = statusRes.data.output;
    if (status === 'failed') throw new Error('Sarvam doc job failed');
  }

  return output; // markdown text
}

// POST /api/ocr/import-dev-plan
router.post('/import-dev-plan', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No document file uploaded' });
  }

  try {
    // ==========================================
    // STEP 1: Sarvam Document Extractor
    // ==========================================
    const pdfBuffer = fs.readFileSync(req.file.path);
    const extractedText = await extractPdfText(pdfBuffer);

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    if (!extractedText?.trim()) {
      return res.status(400).json({ error: 'Could not extract text from document' });
    }

    // ==========================================
    // STEP 2: Gemini Structuring
    // ==========================================
    const prompt = `You are parsing a government local area development plan document for 
an Indian constituency.

Extract ALL proposed projects mentioned in this text.

Text: ${extractedText}

For each project return:
{
  "project_name": string,
  "category": one of ["roads","water_supply","schools","health",
                        "sanitation","electricity","skills","other"],
  "estimated_cost": number in INR or null,
  "description": one sentence,
  "ward_name": ward or area name mentioned or null
}

Return ONLY a JSON array. Empty array [] if no projects found.`;

    const projectsArray = await generateJSON(prompt);

    if (!Array.isArray(projectsArray)) {
      throw new Error('Gemini did not return an array');
    }

    // ==========================================
    // STEP 3: Database Mapping & Insertion
    // ==========================================
    const insertedProjects = [];

    for (const p of projectsArray) {
      let wardId = null;

      // Map ward by name dynamically
      if (p.ward_name) {
        const { data: wards, error: wardError } = await supabase
          .from('wards')
          .select('id')
          .ilike('name', `%${p.ward_name}%`)
          .limit(1);
        
        if (wards && wards.length > 0) {
          wardId = wards[0].id;
        }
      }

      // Insert into dev_plan_projects
      const { data: inserted, error: insertError } = await supabase
        .from('dev_plan_projects')
        .insert({
          ward_id: wardId,
          project_name: p.project_name,
          category: p.category,
          estimated_cost: p.estimated_cost,
          description: p.description,
          source: 'ocr_import',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting project:', insertError);
      } else if (inserted) {
        insertedProjects.push(inserted);
      }
    }

    // Return imported projects and count
    res.json({ 
      imported: insertedProjects.length, 
      projects: insertedProjects 
    });

  } catch (err) {
    console.error('OCR Pipeline Error:', err);
    // Ensure temp file is cleaned up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
