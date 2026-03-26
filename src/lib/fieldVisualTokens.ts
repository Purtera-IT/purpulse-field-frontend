/**
 * Canonical field technician flow — shared Tailwind class tokens (Iteration 6).
 * Keeps spacing, type scale, surfaces, and CTAs coherent without global theme rewrites.
 */

/** Max content width aligned with FieldJobDetail / FieldJobs */
export const FIELD_MAX_WIDTH = 'max-w-2xl'

/** Horizontal padding for page sections */
export const FIELD_PAGE_PAD_X = 'px-4'

/** Vertical padding for main scroll areas */
export const FIELD_PAGE_PAD_Y = 'py-4'

/** Stack gap between major sections on a job tab */
export const FIELD_STACK_GAP = 'space-y-5'

/** Stack gap inside cards */
export const FIELD_INNER_STACK = 'space-y-3'

/** Section overline (eyebrow) — single scale across field v2 */
export const FIELD_OVERLINE =
  'text-[10px] font-semibold text-slate-500 uppercase tracking-wider'

/** Body copy */
export const FIELD_BODY = 'text-xs text-slate-600 leading-relaxed'

/** Metadata / secondary line */
export const FIELD_META = 'text-xs text-slate-500'

/** IDs, mono hints */
export const FIELD_META_MONO = 'text-[11px] text-slate-500 font-mono tabular-nums'

/** Default elevated card */
export const FIELD_CARD =
  'bg-white rounded-xl border border-slate-200/90 shadow-sm'

/** Card with titled header band */
export const FIELD_CARD_HEADER = 'px-4 py-2.5 border-b border-slate-100'

/** Inner padding for card body */
export const FIELD_CARD_BODY = 'p-4'

/** Muted / secondary panel (meetings, audit, etc.) */
export const FIELD_SURFACE_MUTED =
  'rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80'

/** Warning / escalation — distinct but same radius family as cards */
export const FIELD_SURFACE_WARNING =
  'rounded-xl border-2 border-amber-300/90 bg-amber-50/60 shadow-sm ring-1 ring-amber-100/80'

/** Primary action (filled slate) */
export const BTN_PRIMARY =
  'inline-flex items-center justify-center rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50'

/** Secondary (outline) */
export const BTN_SECONDARY =
  'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-50'

/** Danger / destructive */
export const BTN_DANGER =
  'inline-flex items-center justify-center rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50'

/** Segment tabs — same scale as overlines, sentence case */
export const FIELD_TAB_LABEL = 'text-[10px] font-semibold'

/** Compact pill tab (segment control) — inactive */
export const FIELD_TAB_INACTIVE = 'text-slate-500 hover:text-slate-700'

/** Compact pill tab — active */
export const FIELD_TAB_ACTIVE = 'bg-white text-slate-900 shadow-sm'

/** Standard control height */
export const FIELD_CTRL_H = 'h-10'

/** Small badge row for sync / QC tone — neutral slate */
export const FIELD_BADGE_NEUTRAL = 'bg-slate-100 text-slate-700 border border-slate-200/80'

/** Attention without red */
export const FIELD_BADGE_WARN = 'bg-amber-50 text-amber-900 border border-amber-200/80'

/** Primary text CTA (Runbook / Evidence) */
export const FIELD_LINK_PRIMARY =
  'text-xs font-bold text-slate-900 underline underline-offset-2'

/** Secondary text CTA */
export const FIELD_LINK_SECONDARY =
  'text-xs font-semibold text-slate-600 underline underline-offset-2'
