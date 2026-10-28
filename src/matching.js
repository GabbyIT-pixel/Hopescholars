'use strict';
/**
 * Scholarship matching engine (FR 4.1, FR 4.2).
 * Compares a student profile with a scholarship's criteria and returns a 0-100 score
 * plus human-readable reasons, so students can see WHY something was recommended.
 */
function match(profile, s, interestFields = []) {
  if (!profile) return { score: 0, reasons: [], blockers: [] };
  let earned = 0;
  let possible = 0;
  const reasons = [];
  const blockers = [];

  // Education level (weight 30)
  possible += 30;
  if (s.education_level === 'Any') { earned += 20; reasons.push('Open to all education levels'); }
  else if (profile.education_level === s.education_level) { earned += 30; reasons.push(`For ${s.education_level} students`); }
  else if (profile.education_level) blockers.push(`Designed for ${s.education_level} students`);

  // Field of study (weight 25)
  possible += 25;
  if (s.field_of_study === 'Any') { earned += 15; reasons.push('Open to all fields'); }
  else if (profile.field_of_study === s.field_of_study) { earned += 25; reasons.push(`Matches your field: ${s.field_of_study}`); }
  else if (interestFields.includes(s.field_of_study)) { earned += 12; reasons.push(`Similar to scholarships you saved (${s.field_of_study})`); }

  // Country (weight 25)
  possible += 25;
  if (s.country === 'Any') { earned += 15; reasons.push('Open to applicants from any country'); }
  else if (profile.country === s.country) { earned += 25; reasons.push(`Open to students from ${s.country}`); }
  else if (profile.country) blockers.push(`Restricted to ${s.country}`);

  // Financial need (weight 20)
  possible += 20;
  if (!s.need_based) { earned += 10; }
  else if (profile.financial_need === 'High') { earned += 20; reasons.push('Need-based award that fits your financial need'); }
  else if (profile.financial_need === 'Medium') { earned += 12; reasons.push('Need-based award'); }
  else if (profile.financial_need === 'Low') blockers.push('Prioritises students with high financial need');

  let score = Math.round((earned / possible) * 100);
  if (blockers.length) score = Math.min(score, 45);
  return { score, reasons, blockers };
}

module.exports = { match };
