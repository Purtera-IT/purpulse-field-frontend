#!/usr/bin/env node
/**
 * Operational smoke: deployed PurPulse technician API (GET /api/me + GET /api/assignments).
 * Does not ship with the app bundle — run from CI or a laptop with a real JWT.
 *
 * Auth: pass a Bearer token issued for the same API audience as the field app (Entra or HS256 dev).
 * The token's `sub` / email must match a row in `technicians` for /api/me to succeed.
 *
 * Env:
 *   PURPULSE_API_BASE_URL (or AZURE_API_BASE_URL) — required, origin only, no trailing slash
 *   PURPULSE_API_BEARER_TOKEN (or BEARER_TOKEN) — required
 *   EXPECTED_TECHNICIAN_EMAIL — optional; if set, must match /api/me email (case-insensitive)
 *   EXPECTED_TECHNICIAN_ID — optional; if set, must equal /api/me internal_technician_id exactly (after trim)
 *   MIN_ASSIGNMENT_COUNT — optional; if set, assignments.length must be >= this integer
 *   REQUIRE_RUNBOOK — optional; if "true"|"1"|"yes", at least one assignment must have non-empty runbook_json
 *   DUMP_RAW — optional; if "true"|"1"|"yes", print full JSON bodies from /api/me and /api/assignments (for identity debugging)
 *
 * Exit: 0 on PASS, 1 on failure (HTTP error, validation, or policy checks).
 */

const baseUrl = String(
  process.env.PURPULSE_API_BASE_URL || process.env.AZURE_API_BASE_URL || '',
)
  .trim()
  .replace(/\/$/, '')

const bearer = String(
  process.env.PURPULSE_API_BEARER_TOKEN || process.env.BEARER_TOKEN || '',
).trim()

const expectedEmail = (process.env.EXPECTED_TECHNICIAN_EMAIL || '').trim().toLowerCase() || null

const minCountRaw = process.env.MIN_ASSIGNMENT_COUNT
const minAssignmentCount =
  minCountRaw !== undefined && minCountRaw !== '' && !Number.isNaN(Number(minCountRaw))
    ? Math.max(0, parseInt(String(minCountRaw), 10))
    : null

const requireRunbook = /^true|1|yes$/i.test(String(process.env.REQUIRE_RUNBOOK || '').trim())

const dumpRaw = /^true|1|yes$/i.test(String(process.env.DUMP_RAW || '').trim())

const expectedTechnicianId = (process.env.EXPECTED_TECHNICIAN_ID || '').trim() || null

/** @param {unknown} v */
function hasNonEmptyRunbookJson(v) {
  if (v == null) return false
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return false
    try {
      const p = JSON.parse(t)
      return hasNonEmptyRunbookJson(p)
    } catch {
      return true
    }
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    return Object.keys(/** @type {Record<string, unknown>} */ (v)).length > 0
  }
  if (Array.isArray(v)) return v.length > 0
  return true
}

/**
 * @param {string} path
 * @param {string} token
 */
async function fetchJson(path, token) {
  const url = `${baseUrl}${path}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const text = await res.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { _parseError: true, raw: text.slice(0, 500) }
    }
    return { res, body, url, networkError: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      res: null,
      body: null,
      url,
      networkError: msg,
    }
  }
}

/** @param {unknown} a */
function validateAssignmentShape(a, index) {
  if (!a || typeof a !== 'object') {
    return `assignments[${index}]: not an object`
  }
  const o = /** @type {Record<string, unknown>} */ (a)
  if (typeof o.job_id !== 'string' || o.job_id.length === 0) {
    return `assignments[${index}]: missing or invalid job_id`
  }
  if (o.debug != null && typeof o.debug !== 'object') {
    return `assignments[${index}]: debug must be an object when present`
  }
  return null
}

function printUsage() {
  console.log(`
Usage:
  PURPULSE_API_BASE_URL=https://your-api.example.com \\
  PURPULSE_API_BEARER_TOKEN=<jwt> \\
  [EXPECTED_TECHNICIAN_EMAIL=user@corp.com] \\
  [EXPECTED_TECHNICIAN_ID=technician_uid_from_db] \\
  [MIN_ASSIGNMENT_COUNT=1] \\
  [REQUIRE_RUNBOOK=true] \\
  [DUMP_RAW=true] \\
  node scripts/smoke-technician-assignments-api.mjs

Aliases: AZURE_API_BASE_URL, BEARER_TOKEN
`)
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  printUsage()
  process.exit(0)
}

let failed = false
function fail(msg) {
  console.error(`FAIL: ${msg}`)
  failed = true
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

console.log('--- PurPulse technician assignments API smoke ---\n')

if (!baseUrl) {
  fail('PURPULSE_API_BASE_URL or AZURE_API_BASE_URL is required')
}
if (!bearer) {
  fail('PURPULSE_API_BEARER_TOKEN or BEARER_TOKEN is required')
}

if (failed) {
  printUsage()
  process.exit(1)
}

console.log(`API base: ${baseUrl}`)
console.log(`Token: ${bearer.length} chars (Bearer JWT or opaque per API config)\n`)

// --- GET /api/me ---
const mePath = '/api/me'
const me = await fetchJson(mePath, bearer)

if (me.networkError) {
  fail(`GET ${mePath} network error: ${me.networkError}`)
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

if (!me.res.ok) {
  fail(`${mePath} HTTP ${me.res.status} ${me.res.statusText}`)
  if (dumpRaw) console.error('--- DUMP_RAW GET /api/me (HTTP error) ---')
  console.error('Body:', JSON.stringify(me.body, null, 2))
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

const meBody = me.body
if (!meBody || typeof meBody !== 'object') {
  fail('/api/me returned non-object JSON')
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

const internalIdRaw = /** @type {Record<string, unknown>} */ (meBody).internal_technician_id
if (typeof internalIdRaw !== 'string' || internalIdRaw.trim().length === 0) {
  fail('internal_technician_id missing or empty in /api/me response')
  if (dumpRaw && meBody) {
    console.log('\n--- DUMP_RAW GET /api/me (parsed body) ---')
    console.log(JSON.stringify(meBody, null, 2))
  }
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

const internalId = internalIdRaw.trim()

if (dumpRaw) {
  console.log('--- DUMP_RAW GET /api/me ---')
  console.log(JSON.stringify(meBody, null, 2))
  console.log('')
}

const email = /** @type {Record<string, unknown>} */ (meBody).email
const emailStr = email == null ? '' : String(email)

console.log('Resolved technician (GET /api/me):')
console.log(`  internal_technician_id: ${internalId}`)
console.log(`  email: ${emailStr || '(none)'}`)
console.log(
  `  display_name: ${String(/** @type {Record<string, unknown>} */ (meBody).display_name ?? '') || '(none)'}`,
)
console.log(
  `  first_name / last_name: ${String(/** @type {Record<string, unknown>} */ (meBody).first_name ?? '')} / ${String(/** @type {Record<string, unknown>} */ (meBody).last_name ?? '')}`,
)
console.log(
  `  fieldnation_provider_id: ${String(/** @type {Record<string, unknown>} */ (meBody).fieldnation_provider_id ?? '') || '(none)'}\n`,
)

if (expectedEmail) {
  if (!emailStr || emailStr.toLowerCase() !== expectedEmail) {
    fail(
      `EXPECTED_TECHNICIAN_EMAIL mismatch: expected "${expectedEmail}", got "${emailStr || '(empty)'}"`,
    )
  } else {
    ok(`email matches EXPECTED_TECHNICIAN_EMAIL (${expectedEmail})`)
  }
}

if (expectedTechnicianId) {
  if (internalId !== expectedTechnicianId) {
    fail(
      `EXPECTED_TECHNICIAN_ID mismatch: expected "${expectedTechnicianId}", got "${internalId}"`,
    )
  } else {
    ok(`internal_technician_id matches EXPECTED_TECHNICIAN_ID`)
  }
}

if (failed) {
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

// --- GET /api/assignments ---
const q = new URLSearchParams({ assigned_to: internalId })
const assignPath = `/api/assignments?${q.toString()}`
const asg = await fetchJson(assignPath, bearer)

if (asg.networkError) {
  fail(`GET ${assignPath} network error: ${asg.networkError}`)
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

if (!asg.res.ok) {
  fail(`${assignPath} HTTP ${asg.res.status} ${asg.res.statusText}`)
  if (dumpRaw) console.error('--- DUMP_RAW GET /api/assignments (HTTP error) ---')
  console.error('Body:', JSON.stringify(asg.body, null, 2))
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

const asgBody = asg.body
if (!asgBody || typeof asgBody !== 'object') {
  fail('/api/assignments returned non-object JSON')
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

const assignments = /** @type {Record<string, unknown>} */ (asgBody).assignments
if (!Array.isArray(assignments)) {
  fail('response.assignments is not an array')
  if (dumpRaw && asgBody) {
    console.log('\n--- DUMP_RAW GET /api/assignments (parsed body) ---')
    console.log(JSON.stringify(asgBody, null, 2))
  }
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

if (dumpRaw) {
  console.log('--- DUMP_RAW GET /api/assignments ---')
  console.log(JSON.stringify(asgBody, null, 2))
  console.log('')
}

console.log(`Assignment count: ${assignments.length}\n`)

if (minAssignmentCount != null && assignments.length < minAssignmentCount) {
  fail(
    `MIN_ASSIGNMENT_COUNT not met: need >= ${minAssignmentCount}, got ${assignments.length}`,
  )
}

let shapeError = null
for (let i = 0; i < assignments.length; i++) {
  shapeError = validateAssignmentShape(assignments[i], i)
  if (shapeError) break
}
if (shapeError) {
  fail(shapeError)
  console.log('\n=== SUMMARY: FAIL ===')
  process.exit(1)
}

const runbookPresent = assignments.map((a) =>
  hasNonEmptyRunbookJson(/** @type {Record<string, unknown>} */ (a).runbook_json),
)

if (requireRunbook && !runbookPresent.some(Boolean)) {
  fail('REQUIRE_RUNBOOK: no assignment has non-empty runbook_json')
}

console.log('Per-assignment summary:')
console.log('─'.repeat(72))

for (let i = 0; i < assignments.length; i++) {
  const a = /** @type {Record<string, unknown>} */ (assignments[i])
  const jobId = String(a.job_id)
  const title = a.title != null ? String(a.title) : '(no title)'
  const status = a.status != null ? String(a.status) : '(no status)'
  const project = a.project_name != null ? String(a.project_name) : '(none)'
  const site = a.site_name != null ? String(a.site_name) : '(none)'
  const fnWo = a.fieldnation_workorder_id
  const woLabel = fnWo != null && fnWo !== '' ? String(fnWo) : '(none)'
  const rb = runbookPresent[i]
  const dbg = a.debug && typeof a.debug === 'object' ? /** @type {Record<string, unknown>} */ (a.debug) : null
  const reason = dbg && dbg.reason_code != null ? String(dbg.reason_code) : '(none)'

  console.log(`[${i + 1}] job_id: ${jobId}`)
  console.log(`     title: ${title}`)
  console.log(`     status: ${status}`)
  console.log(`     project_name: ${project}`)
  console.log(`     site_name: ${site}`)
  console.log(`     fieldnation_workorder_id: ${woLabel}`)
  console.log(`     runbook_json: ${rb ? 'present (non-empty)' : 'absent or empty'}`)
  console.log(`     debug.reason_code: ${reason}`)
  console.log('')
}

if (minAssignmentCount != null) {
  ok(`assignment count ${assignments.length} >= MIN_ASSIGNMENT_COUNT (${minAssignmentCount})`)
}

if (requireRunbook) {
  ok('REQUIRE_RUNBOOK: at least one assignment has non-empty runbook_json')
}

if (failed) {
  console.log('=== SUMMARY: FAIL ===')
  process.exit(1)
}

console.log('=== SUMMARY: PASS ===')
process.exit(0)
