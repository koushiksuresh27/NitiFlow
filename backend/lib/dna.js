const supabase = require('./supabase');

// Mock SEVERITY_CONFIG adjusted for NitiFlow categories
const SEVERITY_CONFIG = {
  cosmetic: { assets: ['other'], severity: 'low', threshold: 3, window_days: 7, estimated_repair_cost: 0 },
  roads: { assets: ['roads'], severity: 'high', threshold: 2, window_days: 5, estimated_repair_cost: 50000 },
  water: { assets: ['water_supply', 'sanitation'], severity: 'critical', threshold: 2, window_days: 2, estimated_repair_cost: 10000 },
  health: { assets: ['health', 'schools'], severity: 'high', threshold: 2, window_days: 7, estimated_repair_cost: 5000 },
  electricity: { assets: ['electricity', 'street_lights'], severity: 'medium', threshold: 3, window_days: 3, estimated_repair_cost: 2000 }
};

function generateFingerprint(text, category) {
  const stopwords = ['the','a','an','is','in','at','of','and','to',
                     'my','our','please','very','we','i','it','hai',
                     'ka','ki','ko','mera','hamare','karo','kar'];
  const words = (text || '').toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.includes(w))
    .sort();
  return category + '_' + [...new Set(words)].join('_');
}

async function findOrCreateCluster(complaint, fingerprintStr) {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase.from('complaint_clusters')
    .select('*')
    .eq('cluster_date', today);
    
  if (complaint.ward_id) {
    query = query.eq('ward_id', complaint.ward_id);
  } else {
    query = query.is('ward_id', null);
  }

  const { data: todayClusters, error } = await query;
  if (error) console.error("[DNA] Error fetching clusters:", error);

  let bestMatch = null;
  let highestSimilarity = 0;

  if (todayClusters && todayClusters.length > 0) {
    for (const cluster of todayClusters) {
      if (fingerprintStr.split('_')[0] !== cluster.fingerprint.split('_')[0]) continue;
      
      const parts1 = fingerprintStr.split('_').slice(1);
      const parts2 = cluster.fingerprint.split('_').slice(1);
      const set1 = new Set(parts1);
      const set2 = new Set(parts2);
      
      let similarity = 0;
      if (set1.size === 0 && set2.size === 0) similarity = 1;
      else if (set1.size === 0 || set2.size === 0) similarity = 0;
      else {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        similarity = intersection.size / Math.max(set1.size, set2.size);
      }

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = cluster;
      }
    }
  }

  // Threshold provided in instructions
  if (bestMatch && highestSimilarity >= 0.35) {
    const updatedIds = [...(bestMatch.complaint_ids || []), complaint.id];
    await supabase.from('complaint_clusters')
      .update({
        complaint_ids: updatedIds,
        complaint_count: updatedIds.length
      })
      .eq('id', bestMatch.id);

    await supabase.from('complaints')
      .update({ cluster_id: bestMatch.id })
      .eq('id', complaint.id);

    return { is_new_cluster: false, cluster_id: bestMatch.id, is_concurrent: true };
  }

  const { data: newCluster } = await supabase.from('complaint_clusters')
    .insert({
      ward_id: complaint.ward_id,
      fingerprint: fingerprintStr,
      cluster_date: today,
      complaint_ids: [complaint.id],
      complaint_count: 1,
      is_single_incident: true
    })
    .select()
    .single();

  await supabase.from('complaints')
    .update({ cluster_id: newCluster?.id })
    .eq('id', complaint.id);

  return { is_new_cluster: true, cluster_id: newCluster?.id, is_concurrent: false };
}

async function detectPattern(complaint, fingerprintStr, clusterResult) {
  const category = fingerprintStr.split('_')[0].toLowerCase();
  let config = SEVERITY_CONFIG.cosmetic;

  for (const val of Object.values(SEVERITY_CONFIG)) {
    if (val.assets.some(a => category.includes(a))) {
      config = val;
      break;
    }
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - config.window_days);

  let query = supabase.from('complaint_clusters')
    .select('*')
    .gte('cluster_date', windowStart.toISOString().split('T')[0])
    .order('cluster_date', { ascending: true });

  if (complaint.ward_id) {
    query = query.eq('ward_id', complaint.ward_id);
  } else {
    query = query.is('ward_id', null);
  }

  const { data: recentClusters } = await query;

  let matchingClusters = [];
  if (recentClusters && recentClusters.length > 0) {
    for (const cluster of recentClusters) {
      if (fingerprintStr.split('_')[0] !== cluster.fingerprint.split('_')[0]) continue;
      
      const parts1 = fingerprintStr.split('_').slice(1);
      const parts2 = cluster.fingerprint.split('_').slice(1);
      const set1 = new Set(parts1);
      const set2 = new Set(parts2);
      
      let similarity = 0;
      if (set1.size === 0 && set2.size === 0) similarity = 1;
      else if (set1.size === 0 || set2.size === 0) similarity = 0;
      else {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        similarity = intersection.size / Math.max(set1.size, set2.size);
      }

      if (similarity >= 0.35) {
        matchingClusters.push(cluster);
      }
    }
  }

  return {
    distinct_incidents: matchingClusters.length,
    threshold: config.threshold,
    severity: config.severity,
    window_days: config.window_days,
    estimated_cost: config.estimated_repair_cost,
    threshold_hit: matchingClusters.length >= config.threshold,
    clusters: matchingClusters
  };
}

async function createChronicIssue(complaint, fingerprintStr, patternResult, clusterResult) {
  let query = supabase.from('chronic_issues')
    .select('*')
    .eq('status', 'active');
    
  if (complaint.ward_id) {
    query = query.eq('ward_id', complaint.ward_id);
  } else {
    query = query.is('ward_id', null);
  }

  const { data: existingIssues } = await query;
  
  let existing = null;
  if (existingIssues && existingIssues.length > 0) {
    for (const issue of existingIssues) {
      if (fingerprintStr.split('_')[0] !== issue.fingerprint.split('_')[0]) continue;
      
      const parts1 = fingerprintStr.split('_').slice(1);
      const parts2 = issue.fingerprint.split('_').slice(1);
      const set1 = new Set(parts1);
      const set2 = new Set(parts2);
      
      let similarity = 0;
      if (set1.size === 0 && set2.size === 0) similarity = 1;
      else if (set1.size === 0 || set2.size === 0) similarity = 0;
      else {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        similarity = intersection.size / Math.max(set1.size, set2.size);
      }

      if (similarity >= 0.35) {
        existing = issue;
        break;
      }
    }
  }

  let chronicIssue;
  if (existing) {
    const { data: updated } = await supabase.from('chronic_issues')
      .update({
        occurrence_count: patternResult.distinct_incidents,
        last_reported: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();
    chronicIssue = updated;
  } else {
    const firstCluster = patternResult.clusters[0];
    const { data: created } = await supabase.from('chronic_issues')
      .insert({
        ward_id: complaint.ward_id,
        asset_type: fingerprintStr.split('_')[0],
        fault_type: fingerprintStr.split('_').slice(1).join(' '),
        location: complaint.ward_hint || null,
        fingerprint: fingerprintStr,
        occurrence_count: patternResult.distinct_incidents,
        first_reported: firstCluster ? new Date(firstCluster.cluster_date).toISOString() : new Date().toISOString(),
        last_reported: new Date().toISOString(),
        status: 'active',
        severity: patternResult.severity,
        estimated_cost_saved: patternResult.estimated_cost
      })
      .select()
      .single();
    chronicIssue = created;
  }

  if (chronicIssue) {
    await supabase.from('complaints').update({ is_chronic: true, chronic_issue_id: chronicIssue.id }).eq('id', complaint.id);

    await supabase.from('root_cause_tickets')
      .insert({
        chronic_issue_id: chronicIssue.id,
        ward_id: complaint.ward_id,
        title: `ROOT CAUSE: ${fingerprintStr.split('_')[0].toUpperCase()}`,
        description: `This issue has occurred ${patternResult.distinct_incidents} times in ${patternResult.window_days} days. Action required.`,
        status: 'open',
        amc_notified: false
      });
  }

  return { chronicIssue };
}

async function runDNAPipeline(complaint) {
  try {
    const textToFingerprint = complaint.transcript || complaint.summary || '';
    const fingerprintStr = generateFingerprint(textToFingerprint, complaint.category);

    await supabase.from('complaint_fingerprints').insert({
      complaint_id: complaint.id,
      ward_id: complaint.ward_id,
      asset_type: complaint.category,
      fault_type: fingerprintStr.split('_').slice(1).join(' '),
      location: complaint.ward_hint,
      fingerprint: fingerprintStr
    });

    const clusterResult = await findOrCreateCluster(complaint, fingerprintStr);
    if (!clusterResult.is_new_cluster) return; // Concurrent incident, already grouped

    const patternResult = await detectPattern(complaint, fingerprintStr, clusterResult);
    if (!patternResult.threshold_hit) return; // Below chronic threshold

    await createChronicIssue(complaint, fingerprintStr, patternResult, clusterResult);

  } catch (err) {
    console.error('[DNA Pipeline] Error:', err);
  }
}

module.exports = {
  generateFingerprint,
  findOrCreateCluster,
  runDNAPipeline
};
