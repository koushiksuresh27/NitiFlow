const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { generateText } = require('../lib/gemini');

// Helper to build real-time constituency context
async function getProactiveContext(wardId) {
  let contextStr = '';
  const contextUsed = { totalClusters: 0, topCategory: 'none', wardName: 'All Wards' };

  // 1. Top 8 complaint_clusters ORDER BY complaint_count DESC
  let clusterQuery = supabase
    .from('complaint_clusters')
    .select('fingerprint, complaint_count, cluster_date')
    .order('complaint_count', { ascending: false })
    .limit(8);
  
  if (wardId) {
    clusterQuery = clusterQuery.eq('ward_id', wardId);
  }

  const { data: clusters } = await clusterQuery;
  
  contextUsed.totalClusters = clusters ? clusters.length : 0;
  contextStr += `Top Issue Clusters:\n`;
  if (clusters && clusters.length > 0) {
    clusters.forEach(c => {
      contextStr += `- ${c.fingerprint} (${c.complaint_count} incidents)\n`;
    });
  } else {
    contextStr += `- None found.\n`;
  }
  contextStr += '\n';

  // 2. COUNT complaints GROUP BY category
  // Using memory grouping as it's sufficient for this scale, alternatively we'd use an RPC.
  let complaintsQuery = supabase
    .from('complaints')
    .select('category');
  
  if (wardId) {
    complaintsQuery = complaintsQuery.eq('ward_id', wardId);
  }

  const { data: complaints } = await complaintsQuery;
  
  const categoryCounts = {};
  if (complaints) {
    complaints.forEach(c => {
      const cat = c.category || 'other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  }

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0) {
    contextUsed.topCategory = sortedCategories[0][0];
  }

  contextStr += `Total Complaints by Category:\n`;
  sortedCategories.forEach(([cat, count]) => {
    contextStr += `- ${cat}: ${count}\n`;
  });
  if (sortedCategories.length === 0) contextStr += `- None found.\n`;
  contextStr += '\n';

  // 3. Chronic Issues (Active)
  let chronicQuery = supabase
    .from('chronic_issues')
    .select('fingerprint, occurrence_count')
    .eq('status', 'active');
  
  if (wardId) {
    chronicQuery = chronicQuery.eq('ward_id', wardId);
  }

  const { data: chronicIssues } = await chronicQuery;
  contextStr += `Chronic Issues (Flagged for Action):\n`;
  if (chronicIssues && chronicIssues.length > 0) {
    chronicIssues.forEach(c => {
      contextStr += `- ${c.fingerprint} (${c.occurrence_count} incidents)\n`;
    });
  } else {
    contextStr += `- None flagged.\n`;
  }
  contextStr += '\n';

  // 4. Ward Demographics (if wardId provided)
  if (wardId) {
    const { data: ward } = await supabase
      .from('wards')
      .select('*')
      .eq('id', wardId)
      .single();
    
    if (ward) {
      contextUsed.wardName = ward.name;
      contextStr += `Ward Demographics - ${ward.name}:\n`;
      contextStr += `- Population: ${ward.population}\n`;
      contextStr += `- Students: ${ward.students}, Classrooms: ${ward.classrooms}\n`;
      contextStr += `- Hospital Distance: ${ward.hospital_distance_km} km\n`;
      contextStr += `- Skill Centre Distance: ${ward.nearest_skill_centre_distance_km} km\n`;
      contextStr += `- Youth Unemployment Rate: ${(ward.youth_unemployment_rate * 100).toFixed(1)}%\n`;
    }
  }

  return { contextStr, contextUsed };
}

// POST /api/aria/chat
router.post('/chat', async (req, res) => {
  try {
    const { message, wardId, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Step 1: Build Context
    const { contextStr, contextUsed } = await getProactiveContext(wardId);

    // Step 2: Exact System Prompt
    const systemPrompt = `You are Aria, an AI assistant embedded in NitiFlow — a constituency 
intelligence platform for Members of Parliament in India.

You have access to real-time citizen complaint data and ward demographics.
Answer questions about priorities, urgent issues, and specific wards using 
ONLY the data provided in context. Be concise and cite specific numbers.
Never invent data not in the context.

Always end with one specific, actionable recommendation for the MP.`;

    const fullMessage = `DATABASE CONTEXT:\n${contextStr}\n\nMP asks: ${message}`;

    // Step 3: Call Gemini
    const reply = await generateText(systemPrompt, fullMessage, conversationHistory);

    // Step 4: Return response
    res.json({ reply, contextUsed });

  } catch (error) {
    console.error('Aria Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
