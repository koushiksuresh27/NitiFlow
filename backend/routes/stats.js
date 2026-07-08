const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/', async (req, res, next) => {
  try {
    const { data: complaints, error: cErr } = await supabase.from('complaints').select('id, category, is_chronic, ward_id');
    const { data: clusters, error: clErr } = await supabase.from('complaint_clusters').select('id');
    
    if (cErr) throw cErr;
    if (clErr) throw clErr;

    const totalComplaints = complaints?.length || 0;
    const totalClusters = clusters?.length || 0;
    const chronicCount = complaints?.filter(c => c.is_chronic).length || 0;
    
    const wardsSet = new Set();
    complaints?.forEach(c => { if (c.ward_id) wardsSet.add(c.ward_id); });
    const wardsActive = wardsSet.size;

    const categoryCounts = {};
    complaints?.forEach(c => {
      if (c.category) {
        categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      }
    });

    let topCategory = 'None';
    let maxCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topCategory = cat;
      }
    }

    res.json({
      totalComplaints,
      totalClusters,
      chronicCount,
      wardsActive,
      topCategory,
      languagesDetected: ['hi-IN', 'kn-IN', 'en-IN'] // Mocked for demo
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
