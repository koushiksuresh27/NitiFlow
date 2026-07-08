/**
 * Clamps and scales val to 0-1 range
 */
function normalize(val, min, max) {
  if (val <= min) return 0;
  if (val >= max) return 1;
  return (val - min) / (max - min);
}

/**
 * Returns 0-1 score representing how badly this ward needs this category
 */
function computeNeedGap(category, ward) {
  if (!ward) return 0.5;

  switch (category) {
    case 'schools':
      // normalize students per classroom up to 100
      return normalize(ward.students / Math.max(ward.classrooms || 1, 1), 0, 100);
    
    case 'health':
      return normalize(ward.hospital_distance_km || 0, 0, 25);
    
    case 'skills':
      return normalize(ward.nearest_skill_centre_distance_km || 0, 0, 15);
    
    case 'roads':
    case 'sanitation':
    case 'water_supply':
      return normalize(ward.population || 0, 0, 32000);
    
    case 'electricity':
      return normalize(ward.population || 0, 0, 32000) * 0.8;
    
    case 'street_lights':
      return normalize(ward.population || 0, 0, 32000) * 0.6;
    
    default:
      return 0.5;
  }
}

/**
 * Computes the total priority score based on mentions, gap, urgency, and chronic status.
 * item expects: { complaint_count, severity, urgency, is_chronic, category }
 */
function computePriorityScore(item, ward) {
  const mentionScore = normalize(item.complaint_count || 0, 0, 50);
  const gapScore = computeNeedGap(item.category, ward);
  
  const level = (item.severity || item.urgency || 'low').toLowerCase();
  let urgencyScore = 0.3; // Default 'low'
  
  if (level === 'high' || level === 'critical') {
    urgencyScore = 1.0;
  } else if (level === 'medium') {
    urgencyScore = 0.6;
  }

  const chronicBonus = item.is_chronic ? 0.15 : 0;

  const total = (0.35 * mentionScore) + (0.35 * gapScore) + (0.2 * urgencyScore) + chronicBonus;
  
  return { 
    total, 
    mentionScore, 
    gapScore, 
    urgencyScore, 
    chronicBonus 
  };
}

module.exports = {
  normalize,
  computeNeedGap,
  computePriorityScore
};
