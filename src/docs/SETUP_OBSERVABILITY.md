# Setup Observability (Sentry + Analytics)

Quick start for enabling error tracking and telemetry in production.

## 1. Sentry Setup (Error Tracking)

### Create Sentry Account
1. Go to https://sentry.io
2. Sign up or log in
3. Create a new project → Select "React"
4. Copy the **DSN** (looks like: `https://xxx@sentry.io/project`)

### Add Environment Variable
In Base44 Dashboard → Settings → Environment Variables:

```
REACT_APP_SENTRY_DSN=https://xxx@sentry.io/project
REACT_APP_VERSION=2.5.0
```

### Verify It Works
1. Go to any page in the app
2. Open browser DevTools → Console
3. Check for: `[Telemetry] Sentry initialized`
4. Trigger an error (e.g., throw in console)
5. Check Sentry dashboard → it should appear in ~1-2 minutes

## 2. Base44 Analytics (Telemetry)

### No Setup Required
- Base44 analytics are built-in
- Events automatically send to Base44 dashboard
- **Default:** Disabled (opt-in only)

### View Analytics
1. Go to Base44 Dashboard → Analytics
2. View events like:
   - `job_check_in`
   - `evidence_upload_start` / `complete`
   - `time_clock_start` / `stop`
   - `runbook_step_complete`

## 3. Privacy & Compliance

### User Consent
- Telemetry consent banner appears on first visit
- Users can enable/disable anytime in Settings
- Consent stored in localStorage

### What's Tracked
✅ Event names, timestamps, durations
❌ NO email, location, contact info, device IDs

### PII Auto-Scrubbed
Fields containing these words are automatically removed:
- email, phone, address, lat, lon, location, name, user_id, technician_email

## 4. Monitoring & Alerts

### Sentry Alerts
1. Dashboard → Alerts → Create Alert Rule
2. Example: "Error rate > 5% in 1 hour"
3. Notify Slack, email, or PagerDuty

### Base44 Analytics Dashboard
1. View event volume by type
2. Track field ops: check-ins, uploads, time tracking
3. Identify trends and user adoption

## 5. Troubleshooting

### Sentry DSN not working?
- [ ] DSN set in Environment Variables?
- [ ] App redeployed after setting DSN?
- [ ] Check browser console for `[Telemetry] Sentry initialized`

### Events not showing in Base44?
- [ ] User opted into telemetry? (Banner should appear)
- [ ] Check `localStorage.getItem('purpulse_telemetry_enabled')`
- [ ] Network tab: Look for `analytics` requests

### PII appearing in logs?
- [ ] Report bug (should be auto-scrubbed)
- [ ] Check `lib/telemetry.js` PII_FIELDS list
- [ ] Add custom scrubbing if needed

## 6. Customization

### Add Custom Events
```javascript
import { trackEvent } from '@/lib/telemetry';

trackEvent('custom_event', {
  job_id: '123',
  status: 'success',
  duration_ms: 5000,
});
```

### Disable Telemetry Locally
```bash
# In .env (dev only)
REACT_APP_SENTRY_DSN=
```

### Change Sentry Sample Rate
Edit `lib/sentry.js`:
```javascript
tracesSampleRate: 0.5,  // 50% of transactions (default: 10% in prod)
```

## 7. Dashboard Access

### Sentry Dashboard
- https://sentry.io/organizations/purpulse/
- View: Errors, performance, releases, session replay

### Base44 Analytics
- Base44 Dashboard → Analytics
- View: Event volume, user adoption, trends

## 8. Cost Considerations

### Sentry Pricing
- Free tier: 5,000 errors/month (usually sufficient for field app)
- Paid: $29+/month for higher limits

### Base44 Analytics
- Free: Included with Base44 platform

## 9. Best Practices

✅ Do:
- Monitor Sentry dashboard regularly
- Set up alerts for error spikes
- Review analytics monthly for trends
- Keep telemetry events lightweight

❌ Don't:
- Send PII (auto-scrubbed, but avoid it)
- Track too many events (slows app)
- Ignore high error rates
- Store sensitive data in error messages

## 10. Support

- **Sentry Docs:** https://docs.sentry.io/product/
- **Base44 Support:** Contact your Base44 account team
- **Privacy:** See docs/OBSERVABILITY.md for details