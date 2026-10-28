'use strict';
const express = require('express');
const sec = require('../security');
const v = require('../validate');

const router = express.Router();
const provider = [sec.requireLogin, sec.requireRole('provider')];
const formOpts = () => ({ levels: v.LEVELS, fields: v.FIELDS, countries: v.COUNTRIES });

router.get('/provider', ...provider, (req, res) => {
  const rows = req.app.locals.db.prepare('SELECT * FROM scholarships WHERE submitted_by = ? ORDER BY created_at DESC').all(req.user.id);
  res.render('provider', { title: 'My scholarship submissions', rows });
});

router.get('/provider/new', ...provider, (req, res) => {
  res.render('listing-form', { title: 'Submit a scholarship', action: '/provider/new', s: {}, errors: [], ...formOpts(), cancel: '/provider' });
});

router.post('/provider/new', ...provider, (req, res) => {
  const { data, errors } = v.scholarshipInput(req.body);
  if (errors.length) return res.status(400).render('listing-form', { title: 'Submit a scholarship', action: '/provider/new', s: data, errors, ...formOpts(), cancel: '/provider' });
  const t = sec.now();
  const info = req.app.locals.db.prepare(`INSERT INTO scholarships (title, provider, description, eligibility, education_level, field_of_study, country, need_based,
    award_value, deadline, application_url, instructions, status, submitted_by, created_at, updated_at)
    VALUES (@title,@provider,@description,@eligibility,@education_level,@field_of_study,@country,@need_based,@award_value,@deadline,@application_url,@instructions,'pending',@by,@t,@t)`)
    .run({ ...data, by: req.user.id, t });
  req.app.locals.audit(req, 'LISTING_SUBMITTED', `#${info.lastInsertRowid} ${data.title}`);
  req.flash('success', 'Thank you! Your scholarship was submitted and will be published after an administrator verifies it.');
  res.redirect('/provider');
});

function ownEditable(req) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return null;
  return req.app.locals.db.prepare("SELECT * FROM scholarships WHERE id = ? AND submitted_by = ? AND status IN ('pending','rejected')").get(id, req.user.id);
}

router.get('/provider/:id/edit', ...provider, (req, res, next) => {
  const s = ownEditable(req); if (!s) return next();
  res.render('listing-form', { title: 'Edit submission', action: `/provider/${s.id}/edit`, s, errors: [], ...formOpts(), cancel: '/provider' });
});

router.post('/provider/:id/edit', ...provider, (req, res, next) => {
  const existing = ownEditable(req); if (!existing) return next();
  const { data, errors } = v.scholarshipInput(req.body);
  if (errors.length) return res.status(400).render('listing-form', { title: 'Edit submission', action: `/provider/${existing.id}/edit`, s: { ...data, id: existing.id }, errors, ...formOpts(), cancel: '/provider' });
  req.app.locals.db.prepare(`UPDATE scholarships SET title=@title, provider=@provider, description=@description, eligibility=@eligibility, education_level=@education_level,
    field_of_study=@field_of_study, country=@country, need_based=@need_based, award_value=@award_value, deadline=@deadline, application_url=@application_url,
    instructions=@instructions, status='pending', reject_reason=NULL, updated_at=@t WHERE id=@id AND submitted_by=@by`)
    .run({ ...data, id: existing.id, by: req.user.id, t: sec.now() });
  req.app.locals.audit(req, 'LISTING_RESUBMITTED', `#${existing.id}`);
  req.flash('success', 'Submission updated and sent for verification.');
  res.redirect('/provider');
});

module.exports = router;
