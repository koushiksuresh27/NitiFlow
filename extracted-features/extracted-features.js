// ============ 1. VOICE COMPLAINT PIPELINE ============

const fs = require('fs')

// The Sarvam AI Speech-to-Text Integration
// Route handler for converting audio upload to transcript
app.post('/sarvam/transcribe', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData()
    const fileBuffer = fs.readFileSync(req.file.path)
    const blob = new Blob([fileBuffer], { type: req.file.mimetype })
    formData.append('file', blob, req.file.originalname)
    formData.append('model', 'saarika:v2.5')
    formData.append('language_code', req.body.language_code || 'en-IN')

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY
      },
      body: formData
    })
    const data = await response.json()
    
    // Clean up temp file
    fs.unlinkSync(req.file.path)
    
    res.json({ transcript: data.transcript || '' })
  } catch (err) {
    console.error('STT error:', err)
    res.status(500).json({ error: err.message })
  }
})

// The Groq AI Categorization Endpoint
// Turns transcript into category, priority, and confidence score
app.post('/ai/suggest', async (req, res) => {
  try {
    const { transcript } = req.body
    
    if (!transcript?.trim()) {
      return res.status(400).json({ 
        error: 'transcript is required' 
      })
    }

    // TODO: Extract the category list below into a shared enum/constant
    const completion = await 
      groqClients[0].chat.completions
      .create({
        // Note: The original codebase uses llama-3.1-8b-instant for this specific prompt
        model: 'llama-3.1-8b-instant', 
        temperature: 0,
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content: `You are a maintenance 
complaint analyzer for an apartment society.
Extract category and priority from the 
complaint description.

Categories (pick exactly one):
Plumbing, Electrical, Carpentry, HVAC, 
Civil/Structural, Housekeeping, 
Lift/Elevator, General

Priority (pick exactly one):
low, medium, high, critical

Respond ONLY with valid JSON, no markdown,
no explanation:
{"category":"...","priority":"...","confidence": a number between 0 and 100 
representing how certain you are}`
          },
          {
            role: 'user',
            content: transcript.trim()
          }
        ]
      })

    const text = completion.choices[0]
      ?.message?.content?.trim() || ''
    
    // Cleanup markdown if AI included it
    const clean = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()
    
    const parsed = JSON.parse(clean)
    
    res.json(parsed)
    
  } catch (err) {
    console.error('[AI Suggest] Error:', err.message)
    res.status(500).json({ 
      error: err.message,
      category: 'General',
      priority: 'medium',
      confidence: 50
    })
  }
})


// ============ 2. DNA PIPELINE ============

// Fingerprinting Logic
async function generateFingerprint(complaint) {
  try {
    const completion = await groqClients[0].chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'system',
        content: `You are a maintenance complaint analyzer. Extract the core asset and fault from complaints. Return ONLY valid JSON.`
      }, {
        role: 'user',
        content: `Analyze this apartment maintenance complaint and extract:
        1. asset_type: the physical asset (e.g. "lift", "water pump", "generator", "gym ac", "cctv", "corridor light")
        2. fault_type: the type of failure (e.g. "not working", "leaking", "making noise", "door stuck", "power failure", "offline")
        3. location: specific location if mentioned (e.g. "Tower A", "basement", "terrace", "floor 3", null if not mentioned)
        4. fingerprint: combine asset and fault into a short standard code (e.g. "LIFT_DOOR_STUCK", "PUMP_NOT_WORKING", "CCTV_OFFLINE")

        Title: ${complaint.title}
        Description: ${complaint.description}
        Category: ${complaint.category}

        Return exactly:
        {
          "asset_type": "...",
          "fault_type": "...",
          "location": "..." or null,
          "fingerprint": "ASSET_FAULT_CODE"
        }`
      }],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(completion.choices[0].message.content)
    return result
  } catch (err) {
    return {
      asset_type: complaint.category.toLowerCase(),
      fault_type: 'unspecified',
      location: null,
      fingerprint: complaint.category.toUpperCase().replace(/\s+/g, '_') + '_ISSUE'
    }
  }
}

// Clustering Logic
async function checkIncidentCluster(complaint, fingerprint) {
  const today = new Date().toISOString().split('T')[0]

  const { data: todayCluster } = await supabaseAdmin.from('incident_clusters')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .eq('cluster_date', today)
    .single()

  if (todayCluster) {
    const updatedIds = [...todayCluster.complaint_ids, complaint.id]
    await supabaseAdmin.from('incident_clusters')
      .update({
        complaint_ids: updatedIds,
        complaint_count: updatedIds.length
      })
      .eq('id', todayCluster.id)

    await supabaseAdmin.from('complaints')
      .update({
        incident_cluster_id: todayCluster.id,
        fingerprint: fingerprint.fingerprint
      })
      .eq('id', complaint.id)

    return { is_new_cluster: false, cluster_id: todayCluster.id, is_concurrent: true }
  }

  const { data: newCluster } = await supabaseAdmin.from('incident_clusters')
    .insert({
      society_id: complaint.society_id,
      fingerprint: fingerprint.fingerprint,
      cluster_date: today,
      complaint_ids: [complaint.id],
      complaint_count: 1,
      is_single_incident: true
    })
    .select()
    .single()

  await supabaseAdmin.from('complaints')
    .update({
      incident_cluster_id: newCluster.id,
      fingerprint: fingerprint.fingerprint
    })
    .eq('id', complaint.id)

  return { is_new_cluster: true, cluster_id: newCluster.id, is_concurrent: false }
}

// Chronic Issue Detection Logic
// Assumes SEVERITY_CONFIG object exists e.g. { cosmetic: { assets: [], severity: 'low', threshold: 3, window_days: 7, estimated_repair_cost: 0 }, ... }
async function detectPattern(complaint, fingerprint, clusterResult) {
  const assetLower = fingerprint.asset_type.toLowerCase()
  let config = SEVERITY_CONFIG.cosmetic // default

  for (const [key, val] of Object.entries(SEVERITY_CONFIG)) {
    if (val.assets.some(a => assetLower.includes(a))) {
      config = val
      break
    }
  }

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - config.window_days)

  const { data: clusters } = await supabaseAdmin.from('incident_clusters')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .gte('cluster_date', windowStart.toISOString().split('T')[0])
    .order('cluster_date', { ascending: true })

  const distinctIncidents = clusters?.length || 0

  return {
    distinct_incidents: distinctIncidents,
    threshold: config.threshold,
    severity: config.severity,
    window_days: config.window_days,
    estimated_cost: config.estimated_repair_cost,
    threshold_hit: distinctIncidents >= config.threshold,
    clusters
  }
}

async function createChronicIssue(complaint, fingerprint, patternResult, clusterResult) {
  const { data: existing } = await supabaseAdmin.from('chronic_issues')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .eq('status', 'active')
    .single()

  let chronicIssue
  if (existing) {
    const { data: updated } = await supabaseAdmin.from('chronic_issues')
      .update({
        occurrence_count: patternResult.distinct_incidents,
        last_reported: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()
    chronicIssue = updated
  } else {
    const firstCluster = patternResult.clusters[0]
    const { data: created } = await supabaseAdmin.from('chronic_issues')
      .insert({
        society_id: complaint.society_id,
        asset_type: fingerprint.asset_type,
        fault_type: fingerprint.fault_type,
        location: fingerprint.location,
        fingerprint: fingerprint.fingerprint,
        occurrence_count: patternResult.distinct_incidents,
        first_reported: firstCluster ? new Date(firstCluster.cluster_date).toISOString() : new Date().toISOString(),
        last_reported: new Date().toISOString(),
        status: 'active',
        severity: patternResult.severity,
        estimated_cost_saved: patternResult.estimated_cost
      })
      .select()
      .single()
    chronicIssue = created
  }

  await supabaseAdmin.from('complaints').update({ is_chronic: true, chronic_issue_id: chronicIssue.id }).eq('id', complaint.id)

  const { data: rootTicket } = await supabaseAdmin.from('root_cause_tickets')
    .insert({
      chronic_issue_id: chronicIssue.id,
      society_id: complaint.society_id,
      title: \`ROOT CAUSE: \${fingerprint.asset_type.toUpperCase()} — \${fingerprint.fault_type.toUpperCase()}\`,
      description: \`This asset has failed \${patternResult.distinct_incidents} times in \${patternResult.window_days} days. Action required: Document root cause.\`,
      status: 'open',
      amc_notified: false
    })
    .select()
    .single()

  return { chronicIssue, rootTicket }
}

// Pipeline Orchestrator (Synchronous on call, but likely triggered asynchronously in background)
async function runDNAPipeline(complaint) {
  try {
    const fingerprint = await generateFingerprint(complaint)

    await supabaseAdmin.from('complaint_fingerprints').insert({
      complaint_id: complaint.id,
      society_id: complaint.society_id,
      asset_type: fingerprint.asset_type,
      fault_type: fingerprint.fault_type,
      location: fingerprint.location,
      fingerprint: fingerprint.fingerprint
    })

    const clusterResult = await checkIncidentCluster(complaint, fingerprint)
    if (!clusterResult.is_new_cluster) return // Concurrent incident - grouped with today's cluster

    const patternResult = await detectPattern(complaint, fingerprint, clusterResult)
    if (!patternResult.threshold_hit) return // Monitoring - below chronic threshold

    const { chronicIssue, rootTicket } = await createChronicIssue(complaint, fingerprint, patternResult, clusterResult)
    // await notifyChronicIssue(complaint, fingerprint, patternResult, chronicIssue, rootTicket)
  } catch (err) {
    console.error('DNA Pipeline Error:', err)
  }
}


// ============ 3. DOCUMENT INTELLIGENCE OCR PIPELINE ============

const path = require('path')
const os = require('os')
const AdmZip = require('adm-zip')

// Sarvam Document Intelligence OCR Call
async function digitizeDocument(filePath, languageCode = 'en-IN') {
  // sarvamai may be ESM-only — use dynamic import
  const { SarvamAIClient } = await import('sarvamai')
  const client = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY
  })

  const job = await client.documentIntelligence
    .createJob({
      language: languageCode,
      outputFormat: 'md'
    })

  await job.uploadFile(filePath)
  await job.start()
  const status = await job.waitUntilComplete()

  const outputZipPath = path.join(os.tmpdir(), \`sarvam_output_\${Date.now()}.zip\`)
  await job.downloadOutput(outputZipPath)

  const zip = new AdmZip(outputZipPath)
  const entries = zip.getEntries()

  let extractedText = ''
  let jsonData = null

  for (const entry of entries) {
    if (entry.entryName.endsWith('.md')) {
      extractedText += entry.getData().toString('utf8') + '\\n'
    }
    if (entry.entryName.endsWith('.json')) {
      try {
        jsonData = JSON.parse(entry.getData().toString('utf8'))
      } catch (e) {}
    }
  }

  fs.unlink(outputZipPath, () => {})
  fs.unlink(filePath, () => {})

  return { extractedText, jsonData }
}

// Groq Structuring Call (Raw OCR -> Structured Records)
async function parseVendorsFromText(extractedText) {
  const completion = await groqClients[0].chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'system',
      content: \`You extract vendor/contractor records from documents for an apartment maintenance platform. Return ONLY valid JSON, nothing else.\`
    }, {
      role: 'user',
      content: \`Extract all vendor/contractor records from this document content. The content may be HTML, Markdown, or plain text — extract whatever vendor data is present (tables, lists, paragraphs).

For each vendor found, extract these fields:
- company_name (required, the business name)
- service_type (best guess: Plumbing, Electrical, Lift, Security, Housekeeping, Pest Control, Generator, Landscaping, or Other)
- contact_name (person's name if mentioned, else null)
- contact_phone (phone number if mentioned, else null)
- contract_cost (numeric value only, strip ₹/Rs/commas, else null)
- contract_end_date (ISO format YYYY-MM-DD if a date is mentioned, else null)
- notes (any other relevant details, else null)

Document content:
\${extractedText.slice(0, 8000)}

Return exactly this JSON structure:
{"vendors": [{"company_name": "...", "service_type": "...", "contact_name": "...", "contact_phone": "...", "contract_cost": 0, "contract_end_date": null, "notes": "..."}]}

If no vendor data is found, return {"vendors": []}\`
    }],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  })

  const result = JSON.parse(completion.choices[0].message.content)
  return result.vendors || []
}

// API Route tying Upload -> OCR -> Structuring -> Output
app.post('/import/vendors/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  try {
    const { extractedText } = await digitizeDocument(req.file.path, 'en-IN')
    const vendors = await parseVendorsFromText(extractedText)

    res.json({
      success: true,
      vendors,
      count: vendors.length
    })
  } catch (err) {
    res.status(500).json({
      error: 'Import analysis failed',
      details: err.message
    })
  }
})


// ============ 4. ARIA CHAT (AI ASSISTANT) ============

async function processAriaChat(message, societyId, adminId, conversationHistory, plan, responseLanguage) {
  // Real data retrieval step (getProactiveContext fetches stats from DB)
  const context = await getProactiveContext(societyId) // Custom function that loads DB data

  const currentTime = new Date().toLocaleString('en-IN', {
    weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: true
  })

  const isAgentMode = plan === 'growth'

  // Exact system prompt used
  const systemPrompt = \`You are Aria — BlockFlow's Estate Operations Intelligence for this residential society.

You are NOT a generic chatbot. You are a seasoned facility management expert with deep knowledge of Indian residential societies, AMC contracts, monsoon preparedness, and infrastructure maintenance.

\${context.summary}

\${isAgentMode ? \`AGENT MODE ACTIVE 🤖

🚨 CRITICAL RULE — NO HALLUCINATION OF ACTIONS:
You must NEVER claim to have performed an action (assigned a complaint, sent a WhatsApp message, created a schedule, updated a ticket) unless you have ACTUALLY called the corresponding tool function in THIS SAME turn and received a successful tool result.

If the user asks you to perform an action:
1. Call the appropriate tool IMMEDIATELY — do not describe what you are about to do, just call it
2. Wait for the actual tool result
3. ONLY THEN report what happened, based on the real tool result\` : \`ASSISTANT MODE ACTIVE 📖
You can READ data and give recommendations.
You CANNOT take actions directly.\`}

YOUR CORE BEHAVIOR:
1. You have the above live data already loaded
2. Use your tools ONLY when you need ADDITIONAL specific data not shown above
3. Never say "I don't have access to that" — use your tools
4. Always connect dots: if someone asks about a lift complaint, also check if it's a chronic issue
5. Think like an estate manager, not a search engine

YOUR PERSONALITY — ARIA:
- Direct and decisive — give recommendations, not just data
- Proactive — mention related issues the admin didn't ask about
- Cost-conscious — always mention ₹ implications when relevant
- India-aware — understand AMC, society committees, monsoon, festive season impacts
- Concise — under 180 words, always
- Warm but professional

RESPONSE FORMAT — ALWAYS:
🚨 for critical/urgent items
⚠️ for warnings/watch items
📋 for informational items
✅ for good news/all clear

End EVERY response with:
"→ Next action: [one specific thing to do right now]"

CURRENT TIME: \${currentTime}\`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: 'user', content: message }
  ]

  // Model call configuration
  const response = await groqClients[0].chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    tools: availableTools, // tools omitted for brevity
    tool_choice: 'auto',
    temperature: 0.1,
    parallel_tool_calls: false
  })

  // Returns LLM response (would process tool calls here in real impl)
  return response.choices[0].message.content
}


// ============ 5. AUTO-ASSIGNMENT TRIGGER PATTERN ============

/*
This is a PostgreSQL trigger designed to run on a complaints table.
It matches the complaint category to the best available technician based on score and current workload.

SQL Script:

create or replace function auto_assign_complaint()
returns trigger as $$
declare
  best_tech uuid;
begin
  select t.id into best_tech
  from public.technicians t
  join public.users u on u.id = t.user_id
  where t.society_id = new.society_id
    and t.is_available = true
    and t.specializations && array[new.category] -- Matching condition
  order by
    t.performance_score desc,
    (
      select count(*)
      from public.complaints
      where assigned_tech_id = t.id
        and status not in ('closed', 'verified')
    ) asc
  limit 1;

  if best_tech is not null then
    new.assigned_tech_id = best_tech;
    new.status = 'assigned';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger complaint_auto_assign
  before insert on public.complaints
  for each row
  execute function auto_assign_complaint();
*/
