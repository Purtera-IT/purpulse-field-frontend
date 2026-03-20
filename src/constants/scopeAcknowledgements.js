/**
 * Iteration 11 — coverage-driven scope acknowledgements (atlas raw tokens).
 * Used by pre-arrival sheets and optional tool_check_event fields.
 */

/** @type {{ key: string; label: string }[]} */
export const SCOPE_ACKNOWLEDGEMENT_ITEMS = [
  {
    key: 'required_docs_opened_flag',
    label: 'Required SOW / runbook / site documents opened or available offline',
  },
  {
    key: 'risk_flag_ack_flag',
    label: 'Job risk flags and hazard callouts reviewed',
  },
  {
    key: 'customer_notes_review_flag',
    label: 'Customer notes and special instructions reviewed',
  },
  {
    key: 'site_constraint_ack_flag',
    label: 'Site constraints (access hours, PPE zones, escort rules) understood',
  },
  {
    key: 'step_sequence_preview_flag',
    label: 'Expected step sequence / visit plan previewed',
  },
];

/** @type {string[]} */
export const SCOPE_ACKNOWLEDGEMENT_KEYS = SCOPE_ACKNOWLEDGEMENT_ITEMS.map((i) => i.key);

/** Initial checkbox state for UI. */
export function emptyScopeAcknowledgementState() {
  return Object.fromEntries(SCOPE_ACKNOWLEDGEMENT_KEYS.map((k) => [k, false]));
}

/**
 * @param {Record<string, boolean>} state - keys from SCOPE_ACKNOWLEDGEMENT_KEYS → checked
 * @returns {boolean}
 */
export function allScopeAcknowledgementsTrue(state) {
  return SCOPE_ACKNOWLEDGEMENT_KEYS.every((k) => state[k] === true);
}
