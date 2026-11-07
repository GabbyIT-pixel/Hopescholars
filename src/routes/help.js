'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const helpdesk = require('../helpdesk');

const router = express.Router();
const dailyLimiter = rateLimit({
  windowMs: 24 * 3600e3, max: 300, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => res.status(429).json({ answer: 'You have reached the daily question limit. Please come back tomorrow.', links: [], suggestions: [], source: 'kb' }),
});
const askLimiter = rateLimit({
  windowMs: 60e3, max: 20, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => res.status(429).json({ answer: 'You are asking very quickly. Please wait a minute and try again.', links: [], suggestions: [], source: 'kb' }),
});

const faqGroups = () => [
  ['Getting started', ['what', 'free', 'signup', 'google', 'who', 'sources']],
  ['Finding and matching', ['search', 'profile', 'match', 'verified']],
  ['Saving and tracking', ['save', 'reminder', 'track', 'apply', 'deadline']],
  ['Account and safety', ['login', 'reset', 'privacy', 'delete', 'contact']],
  ['For providers and tips', ['provider', 'tips', 'mobile', 'browser']],
].map(([title, ids]) => ({ title, items: ids.map((id) => helpdesk.KB.find((e) => e.id === id)).filter(Boolean) }));

router.get('/guide', (req, res) => res.render('guide', { title: 'How to use Hope Scholar' }));

router.get('/help', (req, res) => {
  res.render('help', { title: 'Help desk', groups: faqGroups(), result: null, asked: '', suggestions: helpdesk.SUGGEST });
});

// Works with JavaScript (JSON reply to the chat panel) and without it (full page).
router.post('/help/ask', dailyLimiter, askLimiter, async (req, res) => {
  const q = String(req.body.q || '').slice(0, 1000);
  const result = await helpdesk.answer(q, { db: req.app.locals.db, user: req.user }, req.body.h);
  if (req.get('x-requested-with') === 'fetch') return res.json(result);
  res.render('help', { title: 'Help desk', groups: faqGroups(), result, asked: q, suggestions: result.suggestions || helpdesk.SUGGEST });
});

module.exports = router;
