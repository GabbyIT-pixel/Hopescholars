'use strict';

const LEVELS = ['Secondary school', 'Undergraduate', 'Postgraduate (Masters)', 'PhD', 'Vocational / Technical'];
const FIELDS = ['Any', 'Computer Science / IT', 'Engineering', 'Health & Medicine', 'Business & Economics', 'Education', 'Agriculture & Environment', 'Law & Public Policy', 'Arts & Humanities', 'Natural Sciences'];
const COUNTRIES = ['Any', 'Rwanda', 'Uganda', 'Kenya', 'Tanzania', 'Burundi', 'DR Congo', 'South Sudan', 'Ethiopia', 'Somalia', 'Other African country', 'Outside Africa'];
const NEEDS = ['High', 'Medium', 'Low', 'Prefer not to say'];
const STANDINGS = ['Top of class', 'Above average', 'Average', 'Prefer not to say'];
const APP_STATUSES = ['Interested', 'Saved', 'Preparing', 'Applied', 'Interview / Next stage', 'Accepted', 'Rejected', 'Withdrawn'];

const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const oneOf = (v, list, fallback = '') => (list.includes(v) ? v : fallback);

function isEmail(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
function isHttpUrl(v) {
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && v.length <= 500;
  } catch { return false; }
}
function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
}
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (iso) => Math.ceil((Date.parse(iso + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 86400e3);

/** Validate & normalise scholarship form input. Returns { data, errors }. */
function scholarshipInput(body) {
  const d = {
    title: clean(body.title, 160),
    provider: clean(body.provider, 160),
    description: clean(body.description, 3000),
    eligibility: clean(body.eligibility, 2000),
    education_level: oneOf(body.education_level, ['Any', ...LEVELS], 'Any'),
    field_of_study: oneOf(body.field_of_study, FIELDS, 'Any'),
    country: oneOf(body.country, COUNTRIES, 'Any'),
    need_based: body.need_based === 'on' || body.need_based === '1' ? 1 : 0,
    award_value: clean(body.award_value, 120),
    deadline: clean(body.deadline, 10),
    application_url: clean(body.application_url, 500),
    instructions: clean(body.instructions, 2000),
  };
  const errors = [];
  if (d.title.length < 5) errors.push('Title must be at least 5 characters.');
  if (d.provider.length < 2) errors.push('Provider name is required.');
  if (d.description.length < 30) errors.push('Description must be at least 30 characters.');
  if (d.eligibility.length < 10) errors.push('Eligibility requirements are required (at least 10 characters).');
  if (!isIsoDate(d.deadline)) errors.push('Please enter a valid deadline date.');
  else if (daysUntil(d.deadline) < 0) errors.push('The deadline must not be in the past.');
  if (!isHttpUrl(d.application_url)) errors.push('Application link must be a valid http(s) web address.');
  return { data: d, errors };
}

module.exports = { LEVELS, FIELDS, COUNTRIES, NEEDS, STANDINGS, APP_STATUSES, clean, oneOf, isEmail, isHttpUrl, isIsoDate, today, daysUntil, scholarshipInput };
