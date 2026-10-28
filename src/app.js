'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const sec = require('./security');
const v = require('./validate');

function createApp(db) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1); // behind the host's HTTPS proxy

  app.locals.db = db;
  app.locals.audit = sec.makeAudit(db);
  app.locals.v = v;
  app.locals.fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  app.locals.fmtTime = (ms) => new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  app.locals.daysLabel = (iso) => {
    const d = v.daysUntil(iso);
    if (d < 0) return 'Closed';
    if (d === 0) return 'Closes today';
    if (d === 1) return '1 day left';
    return `${d} days left`;
  };
  app.locals.urgency = (iso) => { const d = v.daysUntil(iso); return d < 0 ? 'closed' : d <= 7 ? 'urgent' : d <= 30 ? 'soon' : 'ok'; };
  app.locals.demoMode = config.demoMode;

  // ---- security headers (strict CSP: no inline scripts, same-origin only) ----
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'same-origin' },
  }));

  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '1d' : 0 }));
  app.use(express.urlencoded({ extended: false, limit: '30kb' }));
  app.use(sec.sessionMiddleware(db));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store'); // never cache pages that may contain personal data
    res.locals.path = req.path;
    res.locals.flash = res.locals.flash || null;
    res.locals.unread = req.user ? db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c : 0;
    next();
  });
  app.use(sec.csrfProtection);

  // ---- brute-force protection ----
  const limiter = (max, windowMin) => rateLimit({
    windowMs: windowMin * 60e3, max, standardHeaders: true, legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res) => res.status(429).render('error', { title: 'Too many attempts', code: 429, message: 'Too many attempts from your connection. Please wait a few minutes and try again.' }),
  });
  app.use('/login', limiter(20, 15));
  app.use('/register', limiter(15, 60));
  app.use('/forgot', limiter(10, 60));
  app.use('/reset', limiter(20, 60));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use(require('./routes/auth'));
  app.use(require('./routes/student'));
  app.use(require('./routes/scholarships'));
  app.use(require('./routes/provider'));
  app.use(require('./routes/admin'));

  app.use((req, res) => res.status(404).render('error', { title: 'Page not found', code: 404, message: 'We could not find that page.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', code: 500, message: 'Something went wrong on our side. Please try again.' });
  });
  return app;
}

module.exports = { createApp };
