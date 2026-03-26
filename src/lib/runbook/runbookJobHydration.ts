/**
 * Extract presentation fields from runbook_v2 assignment_context / program_context for Job UI.
 * Tolerates multiple canonical shapes (PM seed fixture vs loose passthrough).
 */
import type { RunbookV2SnapshotLoose } from '@/lib/runbook/runbookV2Snapshot'

export function formatSiteAddressFromContext(addr: unknown): string | undefined {
  if (addr == null) return undefined
  if (typeof addr === 'string') {
    const t = addr.trim()
    return t.length ? t : undefined
  }
  if (typeof addr !== 'object' || Array.isArray(addr)) return undefined
  const o = addr as Record<string, unknown>
  const line1 = typeof o.line1 === 'string' ? o.line1 : typeof o.street === 'string' ? o.street : ''
  const line2 = typeof o.line2 === 'string' ? o.line2 : ''
  const city = typeof o.city === 'string' ? o.city : ''
  const state = typeof o.state === 'string' ? o.state : ''
  const postal = typeof o.postal === 'string' ? o.postal : typeof o.zip === 'string' ? o.zip : ''
  const country = typeof o.country === 'string' ? o.country : ''
  const cityState = [city, state].filter(Boolean).join(', ')
  const parts = [line1, line2, cityState, postal, country].map((s) => String(s).trim()).filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

export function buildJobDescriptionFromSnapshot(
  program: Record<string, unknown> | undefined,
  assignment: Record<string, unknown> | undefined,
): string | undefined {
  const chunks: string[] = []
  const pc = program || {}
  const ac = assignment || {}
  const wt = typeof pc.work_type === 'string' ? pc.work_type : ''
  const pn = typeof pc.program_name === 'string' ? pc.program_name : ''
  if (wt || pn) chunks.push([pn, wt].filter(Boolean).join(' — '))
  const scope = typeof pc.scope_summary === 'string' ? pc.scope_summary.trim() : ''
  if (scope) chunks.push(scope)
  const cust = typeof pc.customer_facing_summary === 'string' ? pc.customer_facing_summary.trim() : ''
  if (cust) chunks.push(cust)
  const js = typeof ac.job_summary_status === 'string' ? ac.job_summary_status : ''
  if (js && !chunks.some((c) => c.includes(js))) chunks.push(`Status: ${js}`)
  const out = chunks.filter(Boolean).join('\n\n')
  return out.length ? out : undefined
}

export function extractHazards(program: Record<string, unknown> | undefined): string | undefined {
  if (!program) return undefined
  const h = program.safety_hazards ?? program.hazards
  if (typeof h === 'string' && h.trim()) return h.trim()
  return undefined
}

export type OnSiteContact = { name?: string; phone?: string; email?: string }

export function extractOnSiteContact(
  assignment: Record<string, unknown> | undefined,
  program: Record<string, unknown> | undefined,
): OnSiteContact {
  const ac = assignment || {}
  const pc = program || {}
  const nested =
    (ac.on_site_contact as Record<string, unknown> | undefined) ||
    (ac.site_contact as Record<string, unknown> | undefined) ||
    (pc.on_site_contact as Record<string, unknown> | undefined)
  const name =
    (typeof ac.contact_name === 'string' && ac.contact_name) ||
    (typeof nested?.name === 'string' && nested.name) ||
    (typeof nested?.full_name === 'string' && nested.full_name) ||
    undefined
  const phone =
    (typeof ac.contact_phone === 'string' && ac.contact_phone) ||
    (typeof nested?.phone === 'string' && nested.phone) ||
    (typeof nested?.mobile === 'string' && nested.mobile) ||
    undefined
  const email =
    (typeof ac.contact_email === 'string' && ac.contact_email) ||
    (typeof nested?.email === 'string' && nested.email) ||
    undefined
  return { name, phone, email }
}

export type ProviderInfo = { display?: string; dispatch_phone?: string; fieldnation_provider_id?: string }

export function extractProvider(assignment: Record<string, unknown> | undefined): ProviderInfo {
  const ac = assignment || {}
  const p = ac.provider as Record<string, unknown> | undefined
  if (!p || typeof p !== 'object') {
    return {}
  }
  const display = typeof p.display === 'string' ? p.display : typeof p.name === 'string' ? p.name : undefined
  const dispatch_phone =
    typeof p.dispatch_phone === 'string' ? p.dispatch_phone : typeof p.phone === 'string' ? p.phone : undefined
  const fn =
    p.fieldnation_provider_id != null
      ? String(p.fieldnation_provider_id)
      : p.provider_id != null
        ? String(p.provider_id)
        : undefined
  return { display, dispatch_phone, fieldnation_provider_id: fn }
}

export type ServiceWindow = {
  startIso?: string
  endIso?: string
  timezoneIana?: string
  estimatedMinutes?: number
}

export function extractServiceWindow(assignment: Record<string, unknown> | undefined): ServiceWindow {
  const ac = assignment || {}
  const sw =
    (ac.service_window_local as Record<string, unknown> | undefined) ||
    (ac.service_window as Record<string, unknown> | undefined)
  let startIso: string | undefined
  let endIso: string | undefined
  let timezoneIana: string | undefined
  if (sw && typeof sw === 'object') {
    if (typeof sw.start === 'string') startIso = sw.start
    if (typeof sw.end === 'string') endIso = sw.end
    if (typeof sw.timezone === 'string') timezoneIana = sw.timezone
  }
  const est =
    typeof ac.estimated_duration_minutes === 'number'
      ? ac.estimated_duration_minutes
      : typeof ac.estimated_duration_minutes === 'string'
        ? parseInt(ac.estimated_duration_minutes, 10)
        : undefined
  return {
    startIso,
    endIso,
    timezoneIana,
    estimatedMinutes: Number.isFinite(est as number) ? (est as number) : undefined,
  }
}

/** Format window for display: device-local by default; optional second line for site TZ */
export function formatServiceWindowLines(
  w: ServiceWindow,
  opts?: { mode?: 'device' | 'site' },
): { primary: string; secondary?: string } {
  const mode = opts?.mode ?? 'device'
  if (!w.startIso && !w.endIso) {
    return { primary: '—' }
  }
  try {
    const start = w.startIso ? new Date(w.startIso) : null
    const end = w.endIso ? new Date(w.endIso) : null
    if (mode === 'device') {
      const fmt = (d: Date) =>
        d.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      const primary =
        start && end
          ? `${fmt(start)} → ${fmt(end)}`
          : start
            ? fmt(start)
            : end
              ? fmt(end)
              : '—'
      const tzName =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(start || new Date())
              .find((p) => p.type === 'timeZoneName')?.value
          : undefined
      return {
        primary,
        secondary: tzName ? `Your time (${tzName})` : 'Your local time',
      }
    }
    if (w.timezoneIana && start && end) {
      const fmtSite = (d: Date) =>
        d.toLocaleString(undefined, {
          timeZone: w.timezoneIana,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      return {
        primary: `${fmtSite(start)} → ${fmtSite(end)}`,
        secondary: `Site local (${w.timezoneIana})`,
      }
    }
  } catch {
    /* fall through */
  }
  return { primary: w.startIso && w.endIso ? `${w.startIso} → ${w.endIso}` : (w.startIso ?? w.endIso ?? '—') }
}

export type EquipmentItem = { id?: string; label: string; required?: boolean; notes?: string }
export type DeliverableItem = { id?: string; label: string; evidence?: string[] }

export function extractEquipmentAndDeliverables(snapshot: RunbookV2SnapshotLoose): {
  equipment: EquipmentItem[]
  deliverables: DeliverableItem[]
} {
  const pc = (snapshot.program_context || {}) as Record<string, unknown>
  const root = snapshot as unknown as Record<string, unknown>
  const rawEq = (pc.equipment_expectations ?? root.equipment_expectations) as unknown
  const rawDel = (pc.deliverables ?? root.deliverables) as unknown

  const equipment: EquipmentItem[] = []
  if (Array.isArray(rawEq)) {
    for (const row of rawEq) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const label = typeof o.label === 'string' ? o.label : typeof o.name === 'string' ? o.name : ''
      if (!label.trim()) continue
      equipment.push({
        id: typeof o.id === 'string' ? o.id : undefined,
        label: label.trim(),
        required: typeof o.required === 'boolean' ? o.required : undefined,
        notes: typeof o.notes === 'string' ? o.notes : undefined,
      })
    }
  }

  const deliverables: DeliverableItem[] = []
  if (Array.isArray(rawDel)) {
    for (const row of rawDel) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const label = typeof o.label === 'string' ? o.label : typeof o.title === 'string' ? o.title : ''
      if (!label.trim()) continue
      deliverables.push({
        id: typeof o.id === 'string' ? o.id : undefined,
        label: label.trim(),
        evidence: Array.isArray(o.evidence) ? (o.evidence as string[]) : undefined,
      })
    }
  }

  return { equipment, deliverables }
}
