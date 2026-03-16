/**
 * Mock data for the dual-mode Chat page.
 */

export const MOCK_ACTIVE_JOB = {
  id: 'mock-j1',
  title: 'Macro Cell Tower — Foundation Phase',
  site_name: 'Oakland Site A',
  site_address: '1234 Industrial Blvd, Oakland CA',
  status: 'in_progress',
  current_task: 'Install ground strap to tower leg #3',
  assigned_pm: 'Sarah Chen',
  pm_phone: '+1 (510) 555-0182',
};

const now = () => new Date().toISOString();
function ago(mins) { return new Date(Date.now() - mins * 60 * 1000).toISOString(); }

export const MOCK_AI_MESSAGES = [
  {
    id: 'ai-1', role: 'assistant',
    content: "Hi! I'm your Purpulse job assistant. I have context on your current job — **Macro Cell Tower Foundation Phase** at Oakland Site A.\n\nHow can I help you right now?",
    sent_at: ago(12),
  },
  {
    id: 'ai-2', role: 'user',
    content: "What torque spec should I use for the anchor bolt installation?",
    sent_at: ago(10),
  },
  {
    id: 'ai-3', role: 'assistant',
    content: "For a standard **3-leg monopole foundation** (which matches your tower type), anchor bolt torque specs are typically:\n\n• **Grade 5 bolts (5/8\"):** 150–180 ft-lbs\n• **Grade 8 bolts (3/4\"):** 280–320 ft-lbs\n\n⚠️ Always verify against your specific structural drawings in the job files. If the spec sheet isn't attached, contact your PM to confirm before torquing.\n\nDo you need help finding the structural docs?",
    sent_at: ago(9),
  },
  {
    id: 'ai-4', role: 'user',
    content: "The ground strap won't reach the tower leg. What should I do?",
    sent_at: ago(3),
  },
  {
    id: 'ai-5', role: 'assistant',
    content: "That's a scope change situation. Here's what to do:\n\n1. **Document it now** — take a photo of the gap with a tape measure visible\n2. **Log a blocker** in the Tasks tab with type "scope_change"\n3. **Notify your PM** — this typically requires a field change order\n\nDo you want me to draft the escalation message to your PM automatically?",
    sent_at: ago(1),
  },
];

export const MOCK_PM_MESSAGES = [
  {
    id: 'pm-1', role: 'pm', sender: 'Sarah Chen',
    content: "Morning! Just checking in — did you make it to Oakland Site A okay?",
    sent_at: ago(95),
  },
  {
    id: 'pm-2', role: 'me',
    content: "Yes, arrived at 08:12. Starting site walkthrough now.",
    sent_at: ago(90),
  },
  {
    id: 'pm-3', role: 'pm', sender: 'Sarah Chen',
    content: "Great. FYI — the utility crew ran a bit late this morning so the concrete may still be curing in section C. Avoid that area until you get clearance.",
    sent_at: ago(82),
  },
  {
    id: 'pm-4', role: 'me',
    content: "Understood. I'll hold off on section C and start with the anchor bolt inspection on legs 1 and 2.",
    sent_at: ago(80),
  },
  {
    id: 'pm-5', role: 'pm', sender: 'Sarah Chen',
    content: "Perfect. Let me know if anything looks off — I'm available all day.",
    sent_at: ago(78),
  },
];