/**
 * Mock runbook for "Macro Cell Tower Installation" (mock-j1)
 * Used as demo data when no DB runbook_phases exist.
 */

export const MOCK_RUNBOOK = [
  {
    id: 'ph-1',
    name: 'Site Preparation & Safety',
    order: 1,
    color: 'amber',
    tasks: [
      {
        id: 'task-1-1',
        phase_id: 'ph-1',
        title: 'Conduct Pre-Work Safety Briefing',
        order: 1,
        gate: 'blocking',        // blocking | warning | info
        duration_est: '15 min',
        status: 'done',
        instructions: 'Gather all crew members before any physical work begins. Review job hazard analysis (JHA), confirm PPE compliance, identify emergency egress routes, and verify LOTO procedures are understood by all personnel.',
        tips: [
          'Take a group photo as documented evidence of the safety briefing.',
          'Verify all crew have signed the JHA acknowledgment form.',
        ],
        common_mistakes: [
          'Skipping briefing when the team has done the job before — always required.',
          'Not verifying PPE is ANSI-rated for height work.',
        ],
        deliverables: [
          { id: 'd-1-1-1', type: 'photo',     label: 'Crew safety briefing photo',    required: true,  status: 'qc_pass',    qc_score: 91, captured_at: '2026-03-16T08:12:00Z' },
          { id: 'd-1-1-2', type: 'signature',  label: 'JHA sign-off (site foreman)',   required: true,  status: 'qc_pass',    captured_at: '2026-03-16T08:15:00Z' },
          { id: 'd-1-1-3', type: 'timestamp',  label: 'Safety briefing completed at',  required: true,  status: 'captured',   value: '2026-03-16T08:15:00Z' },
        ],
        checks: [
          { id: 'c-1-1-1', label: 'PPE verified for all crew',           done: true  },
          { id: 'c-1-1-2', label: 'Emergency contacts posted',           done: true  },
          { id: 'c-1-1-3', label: 'LOTO procedures reviewed',            done: true  },
          { id: 'c-1-1-4', label: 'Fall arrest systems inspected',       done: true  },
        ],
      },
      {
        id: 'task-1-2',
        phase_id: 'ph-1',
        title: 'Establish Site Perimeter & Access Control',
        order: 2,
        gate: 'blocking',
        duration_est: '20 min',
        status: 'done',
        instructions: 'Set up safety barriers around the base of the tower with a minimum 15ft exclusion zone. Place signage at all entry points. Verify no unauthorized personnel can enter the work zone.',
        tips: [
          'Use orange safety cones at minimum — hard barriers preferred for public-facing sites.',
          'Photograph all four sides of the perimeter for the job record.',
        ],
        common_mistakes: [
          'Perimeter too small — overhead drop zone must extend full boom radius.',
        ],
        deliverables: [
          { id: 'd-1-2-1', type: 'photo', label: 'Perimeter — North view',  required: true, status: 'qc_pass',    qc_score: 88, captured_at: '2026-03-16T08:35:00Z' },
          { id: 'd-1-2-2', type: 'photo', label: 'Perimeter — South view',  required: true, status: 'qc_pass',    qc_score: 85, captured_at: '2026-03-16T08:36:00Z' },
          { id: 'd-1-2-3', type: 'photo', label: 'Perimeter — Entry signage', required: true, status: 'qc_warning', qc_score: 47, qc_warning: 'Image is slightly blurry — retake recommended for compliance', gps_accuracy: 8, geo_lat: 37.7749, geo_lon: -122.4194, captured_at: '2026-03-16T08:37:00Z' },
          { id: 'd-1-2-4', type: 'note',  label: 'Access restrictions noted', required: false, status: 'captured', value: 'East gate locked, contractor badge required. Security on-site 24/7.' },
        ],
        checks: [
          { id: 'c-1-2-1', label: '15ft exclusion zone established', done: true  },
          { id: 'c-1-2-2', label: 'All entry points signed',         done: true  },
          { id: 'c-1-2-3', label: 'Site supervisor notified',        done: true  },
        ],
      },
      {
        id: 'task-1-3',
        phase_id: 'ph-1',
        title: 'Record Pre-Work Site Conditions',
        order: 3,
        gate: 'warning',
        duration_est: '10 min',
        status: 'in_progress',
        instructions: 'Document the site as-found condition before any work begins. Capture all four sides of the work area, record the site contact sign-in timestamp, and note any existing damage or hazards.',
        tips: ['Photograph in landscape orientation for panoramic context.'],
        common_mistakes: ['Forgetting to capture the sign-in timestamp — required for billing audit.'],
        deliverables: [
          // Demo: blurry photo warning
          {
            id: 'd-1-3-1', type: 'photo', label: 'Site overview (as-found)',
            required: true, status: 'qc_warning', qc_score: 44,
            qc_warning: 'Image is slightly blurry — retake recommended for compliance',
            gps_accuracy: 9, geo_lat: 37.7749, geo_lon: -122.4194,
            captured_at: '2026-03-16T08:55:00Z',
          },
          // Demo: low GPS confidence
          {
            id: 'd-1-3-2', type: 'photo', label: 'Equipment staging area',
            required: true, status: 'qc_warning', qc_score: 81,
            qc_warning: 'Low GPS confidence — photo may not be correctly geo-tagged (±72m accuracy)',
            gps_accuracy: 72, geo_lat: 37.7751, geo_lon: -122.4188,
            captured_at: '2026-03-16T08:57:00Z',
          },
          // Demo: missing required signature
          {
            id: 'd-1-3-3', type: 'signature', label: 'Site contact sign-in',
            required: true, status: 'pending',
          },
          // Demo: missing required timestamp
          {
            id: 'd-1-3-4', type: 'timestamp', label: 'Pre-work start timestamp',
            required: true, status: 'pending',
          },
          // Demo: optional note
          {
            id: 'd-1-3-5', type: 'note', label: 'Existing damage / site notes',
            required: false, status: 'pending',
          },
        ],
        checks: [
          { id: 'c-1-3-1', label: 'All four sides photographed', done: false },
          { id: 'c-1-3-2', label: 'Site contact present & identified', done: true  },
          { id: 'c-1-3-3', label: 'No pre-existing damage unclaimed', done: false },
        ],
      },
    ],
  },
  {
    id: 'ph-2',
    name: 'Foundation & Grounding',
    order: 2,
    color: 'blue',
    tasks: [
      {
        id: 'task-2-1',
        phase_id: 'ph-2',
        title: 'Inspect Existing Foundation Anchors',
        order: 3,
        gate: 'blocking',
        duration_est: '30 min',
        status: 'in_progress',
        instructions: 'Visually and physically inspect all foundation anchor bolts. Verify torque spec matches engineering drawings. Document any corrosion, cracking, or deformation. Use the provided torque wrench calibrated to spec.',
        tips: [
          'Use a wire brush to clean rust before reading torque.',
          'Mark each bolt after verification to avoid double-counting.',
        ],
        common_mistakes: [
          'Using uncalibrated torque wrenches.',
          'Not photographing both pre- and post-torque states.',
        ],
        deliverables: [
          { id: 'd-2-1-1', type: 'photo',        label: 'Foundation bolt array (overview)',    required: true,  status: 'qc_pass',    qc_score: 89, captured_at: '2026-03-16T09:10:00Z' },
          { id: 'd-2-1-2', type: 'photo',        label: 'Close-up: torque marks on bolts',    required: true,  status: 'pending' },
          { id: 'd-2-1-3', type: 'test_result',  label: 'Torque test (ft-lb per bolt)',       required: true,  status: 'pending' },
          { id: 'd-2-1-4', type: 'field_input',  label: 'Number of anchor bolts verified',    required: true,  status: 'pending', field_type: 'number', field_unit: 'bolts' },
        ],
        checks: [
          { id: 'c-2-1-1', label: 'Visual inspection complete',      done: true  },
          { id: 'c-2-1-2', label: 'Torque wrench calibrated',        done: true  },
          { id: 'c-2-1-3', label: 'All bolts marked & verified',     done: false },
          { id: 'c-2-1-4', label: 'No structural defects found',     done: false },
        ],
      },
      {
        id: 'task-2-2',
        phase_id: 'ph-2',
        title: 'Install & Test Ground System',
        order: 4,
        gate: 'blocking',
        duration_est: '45 min',
        status: 'pending',
        instructions: 'Install copper grounding electrode conductor from tower base to ground rod per NEC 810. Verify ground resistance is ≤10 ohms using an earth ground resistance tester. Document all measurements.',
        tips: [
          'Take resistance reading 3 times and record the average.',
          'Ensure all connections are exothermically welded or listed irreversible compression fittings.',
        ],
        common_mistakes: [
          'Using mechanical connections instead of listed connectors.',
          'Not testing after final torque — resistance can change.',
        ],
        deliverables: [
          { id: 'd-2-2-1', type: 'photo',       label: 'Ground rod installation',         required: true,  status: 'pending' },
          { id: 'd-2-2-2', type: 'photo',       label: 'Conductor connection close-up',   required: true,  status: 'pending' },
          { id: 'd-2-2-3', type: 'test_result', label: 'Earth ground resistance (ohms)',   required: true,  status: 'pending', test_spec: '≤ 10 Ω', test_pass_threshold: 10 },
          { id: 'd-2-2-4', type: 'timestamp',   label: 'Ground system certified at',      required: true,  status: 'pending' },
        ],
        checks: [
          { id: 'c-2-2-1', label: 'GEC installed per NEC 810',    done: false },
          { id: 'c-2-2-2', label: 'Ground rod installed ≥8ft',    done: false },
          { id: 'c-2-2-3', label: 'Resistance ≤10Ω confirmed',    done: false },
        ],
      },
    ],
  },
  {
    id: 'ph-3',
    name: 'Tower Erection',
    order: 3,
    color: 'purple',
    tasks: [
      {
        id: 'task-3-1',
        phase_id: 'ph-3',
        title: 'Assemble Base Tower Section',
        order: 5,
        gate: 'warning',
        duration_est: '2 hr',
        status: 'pending',
        instructions: 'Assemble first 40ft base section per manufacturer torque specs. Install climbing pegs and safety climb system. Verify all flange connections are tight. Record serial numbers of all structural components.',
        tips: [
          'Work bottom-up — never assemble sections out of order.',
          'Apply anti-seize on all bolt threads per spec.',
        ],
        common_mistakes: [
          'Reversing flange orientation — check arrow markings.',
          'Skipping anti-seize — leads to galling.',
        ],
        deliverables: [
          { id: 'd-3-1-1', type: 'photo',       label: 'Base section assembled',           required: true,  status: 'pending' },
          { id: 'd-3-1-2', type: 'field_input', label: 'Tower section serial number',      required: true,  status: 'pending', field_type: 'text' },
          { id: 'd-3-1-3', type: 'photo',       label: 'Flange torque marks',              required: true,  status: 'pending' },
          { id: 'd-3-1-4', type: 'test_result', label: 'Plumb reading (degrees off vert)', required: true,  status: 'pending', test_spec: '≤ 0.5°', test_pass_threshold: 0.5 },
        ],
        checks: [
          { id: 'c-3-1-1', label: 'All sections assembled in order', done: false },
          { id: 'c-3-1-2', label: 'Climbing pegs installed',         done: false },
          { id: 'c-3-1-3', label: 'Safety climb system verified',    done: false },
          { id: 'c-3-1-4', label: 'Plumb verified ≤0.5°',           done: false },
        ],
      },
    ],
  },
  {
    id: 'ph-4',
    name: 'Antenna & Cable Installation',
    order: 4,
    color: 'emerald',
    tasks: [
      {
        id: 'task-4-1',
        phase_id: 'ph-4',
        title: 'Mount Antenna Arrays',
        order: 6,
        gate: 'blocking',
        duration_est: '3 hr',
        status: 'pending',
        instructions: 'Mount sector antennas per azimuth and tilt specs on approved drawings. Verify antenna orientation with a compass (± 2° tolerance). Install all hardware to spec torque. Label all antenna ports with sector designation.',
        tips: [
          'Use a digital inclinometer for tilt verification — eyeballing is never acceptable.',
          'Photograph compass heading aligned with antenna face for each sector.',
        ],
        common_mistakes: [
          'Confusing 0/120/240° sectors in multi-carrier builds.',
          'Not weatherproofing RF connectors after test.',
        ],
        deliverables: [
          { id: 'd-4-1-1', type: 'photo',       label: 'Sector A antenna mounted',       required: true, status: 'pending' },
          { id: 'd-4-1-2', type: 'photo',       label: 'Sector B antenna mounted',       required: true, status: 'pending' },
          { id: 'd-4-1-3', type: 'photo',       label: 'Sector C antenna mounted',       required: true, status: 'pending' },
          { id: 'd-4-1-4', type: 'test_result', label: 'Azimuth A (°)',                  required: true, status: 'pending', test_spec: '0° ± 2°' },
          { id: 'd-4-1-5', type: 'test_result', label: 'Azimuth B (°)',                  required: true, status: 'pending', test_spec: '120° ± 2°' },
          { id: 'd-4-1-6', type: 'test_result', label: 'Azimuth C (°)',                  required: true, status: 'pending', test_spec: '240° ± 2°' },
        ],
        checks: [
          { id: 'c-4-1-1', label: 'All 3 sectors mounted',             done: false },
          { id: 'c-4-1-2', label: 'Azimuths verified within ±2°',      done: false },
          { id: 'c-4-1-3', label: 'Antenna labels installed',           done: false },
        ],
      },
    ],
  },
  {
    id: 'ph-5',
    name: 'Closeout & Sign-off',
    order: 5,
    color: 'teal',
    tasks: [
      {
        id: 'task-5-1',
        phase_id: 'ph-5',
        title: 'Site Clean-up & Final Walkthrough',
        order: 7,
        gate: 'info',
        duration_est: '30 min',
        status: 'pending',
        instructions: 'Remove all tools, materials, and debris from the site. Restore any disturbed surfaces. Verify perimeter barriers are removed. Conduct final walkthrough with site contact and obtain sign-off.',
        tips: [
          'Use the site clean-up checklist in the job brief.',
          'Take a panoramic "after" photo from the same angle as the pre-work photo.',
        ],
        common_mistakes: [
          'Leaving cable scrap in conduit trays.',
          'Not getting client sign-off before leaving.',
        ],
        deliverables: [
          { id: 'd-5-1-1', type: 'photo',     label: 'Site clean (overview after)',  required: true,  status: 'pending' },
          { id: 'd-5-1-2', type: 'signature', label: 'Client site acceptance sign-off', required: true, status: 'pending' },
          { id: 'd-5-1-3', type: 'note',      label: 'Punch list / open items',      required: false, status: 'pending' },
          { id: 'd-5-1-4', type: 'timestamp', label: 'Site closeout time',           required: true,  status: 'pending' },
        ],
        checks: [
          { id: 'c-5-1-1', label: 'All tools removed from site',     done: false },
          { id: 'c-5-1-2', label: 'Perimeter barriers removed',      done: false },
          { id: 'c-5-1-3', label: 'Site contact walkthrough done',   done: false },
          { id: 'c-5-1-4', label: 'Client sign-off obtained',        done: false },
        ],
      },
    ],
  },
];

export function getRunbook(job) {
  if (job?.runbook_phases?.length) return job.runbook_phases;
  return MOCK_RUNBOOK;
}