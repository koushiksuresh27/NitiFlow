const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { computePriorityScore } = require('../lib/scoring');

// GET /api/priorities
router.get('/', async (req, res) => {
  try {
    // 1. Fetch all rows from complaint_clusters, joining wards table
    const { data: clusters, error: clusterError } = await supabase
      .from('complaint_clusters')
      .select('*, wards(*)');
      
    if (clusterError) throw clusterError;

    // 2. Fetch all rows from dev_plan_projects, joining wards table
    const { data: projects, error: projectError } = await supabase
      .from('dev_plan_projects')
      .select('*, wards(*)');

    if (projectError) throw projectError;

    // 3. Score clusters
    const scoredClusters = (clusters || []).map(cluster => {
      // Map properties so computePriorityScore receives expected item shape
      const item = {
        ...cluster,
        category: cluster.fingerprint ? cluster.fingerprint.split('_')[0] : 'other'
      };
      
      const score = computePriorityScore(item, cluster.wards);
      return {
        ...cluster,
        type: 'citizen_cluster',
        score_breakdown: score,
        total_score: score.total
      };
    });

    // 4. Score dev_plan items
    const scoredProjects = (projects || []).map(project => {
      const item = {
        ...project,
        complaint_count: 0,
        severity: 'medium',
        is_chronic: false,
        category: project.category
      };
      
      const score = computePriorityScore(item, project.wards);
      return {
        ...project,
        type: 'dev_plan',
        score_breakdown: score,
        total_score: score.total
      };
    });

    // 5. Merge both arrays, sort by total score descending
    const combined = [...scoredClusters, ...scoredProjects];
    combined.sort((a, b) => b.total_score - a.total_score);

    // 6. Return full array
    res.json(combined);
  } catch (error) {
    console.error('Priorities API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/priorities/ward/:wardId
router.get('/ward/:wardId', async (req, res) => {
  try {
    const { wardId } = req.params;

    const { data: clusters, error: clusterError } = await supabase
      .from('complaint_clusters')
      .select('*, wards(*)')
      .eq('ward_id', wardId);
      
    if (clusterError) throw clusterError;

    const { data: projects, error: projectError } = await supabase
      .from('dev_plan_projects')
      .select('*, wards(*)')
      .eq('ward_id', wardId);

    if (projectError) throw projectError;

    const scoredClusters = (clusters || []).map(cluster => {
      const item = {
        ...cluster,
        category: cluster.fingerprint ? cluster.fingerprint.split('_')[0] : 'other'
      };
      const score = computePriorityScore(item, cluster.wards);
      return {
        ...cluster,
        type: 'citizen_cluster',
        score_breakdown: score,
        total_score: score.total
      };
    });

    const scoredProjects = (projects || []).map(project => {
      const item = {
        ...project,
        complaint_count: 0,
        severity: 'medium',
        is_chronic: false,
        category: project.category
      };
      const score = computePriorityScore(item, project.wards);
      return {
        ...project,
        type: 'dev_plan',
        score_breakdown: score,
        total_score: score.total
      };
    });

    const combined = [...scoredClusters, ...scoredProjects];
    combined.sort((a, b) => b.total_score - a.total_score);

    res.json(combined);
  } catch (error) {
    console.error('Priorities Ward API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
