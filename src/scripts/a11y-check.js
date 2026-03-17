/**
 * a11y-check.js — axe-core accessibility sweep for key Purpulse screens.
 *
 * Usage:
 *   node scripts/a11y-check.js
 *
 * Requires:
 *   npm install -D axe-core puppeteer
 *
 * Checks Jobs table, JobDetail cockpit, and Timer screen against WCAG 2.1 AA.
 * Exits with code 1 if any critical or serious violations are found.
 */

const puppeteer = require('puppeteer');
const { default: axe } = require('axe-core');

const BASE_URL = process.env.A11Y_BASE_URL || 'http://localhost:5173';

const PAGES = [
  { name: 'Jobs table',  path: '/Jobs'              },
  { name: 'Job Detail',  path: '/JobDetail?id=job-1' },
  { name: 'Time Log',    path: '/TimeLog'            },
  { name: 'Profile',     path: '/Profile'            },
];

async function runChecks() {
  const browser = await puppeteer.launch({ headless: 'new' });
  let totalViolations = 0;

  for (const page of PAGES) {
    const tab = await browser.newPage();
    await tab.goto(`${BASE_URL}${page.path}`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Inject axe-core
    await tab.addScriptTag({ content: axe.source });

    const results = await tab.evaluate(async () => {
      return await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        },
      });
    });

    const critical = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));

    console.log(`\n── ${page.name} (${page.path}) ──────────────────`);
    if (critical.length === 0) {
      console.log('  ✓ No critical/serious violations');
    } else {
      critical.forEach(v => {
        console.error(`  ✗ [${v.impact.toUpperCase()}] ${v.id}: ${v.description}`);
        v.nodes.slice(0, 3).forEach(n => {
          console.error(`      → ${n.html.slice(0, 120)}`);
        });
      });
      totalViolations += critical.length;
    }

    // Also print warnings (moderate/minor)
    const warnings = results.violations.filter(v => !['critical', 'serious'].includes(v.impact));
    warnings.forEach(v => {
      console.warn(`  ⚠ [${v.impact}] ${v.id}: ${v.description}`);
    });

    await tab.close();
  }

  await browser.close();

  console.log(`\n══ Summary: ${totalViolations} critical/serious violation(s) across ${PAGES.length} pages ══\n`);
  if (totalViolations > 0) {
    process.exit(1);
  }
}

runChecks().catch(err => {
  console.error('a11y-check failed:', err.message);
  process.exit(1);
});