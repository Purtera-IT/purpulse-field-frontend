import { v4 as uuidv4 } from 'uuid';

type ConnectivityState = 'offline' | 'cellular' | 'wifi' | 'unknown';

type GeoPoint = {
  lat: number;
  lon: number;
  accuracy_m: number;
};

type TelemetryConsent = {
  location: boolean;
  device: boolean;
};

type BaseEventInput = {
  accessToken: string;
  job_id: string;
  technician_id: string;
  site_id?: string | null;
  dispatch_id?: string | null;
  project_id?: string | null;
  session_id?: string | null;
  device_id?: string | null;
  event_ts_utc?: string;
  client_ts?: string;
  connectivity_state?: ConnectivityState | null;
  telemetry_consent?: TelemetryConsent;
  location?: GeoPoint | null;
};

type DispatchEventInput = BaseEventInput & {
  dispatch_id: string | null;
  status: 'assigned' | 'enroute' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled' | 'declined';
  assignment_id: string | null;
  accept_flag: boolean | null;
  decline_flag: boolean | null;
  offer_timestamp: string | null;
  response_timestamp: string | null;
  cancel_timestamp: string | null;
  planned_eta_timestamp: string | null;
  eta_ack_timestamp: string | null;
  eta_update_timestamp: string | null;
  route_departure_timestamp: string | null;
  scheduled_start_timestamp: string | null;
  location: { [key: string]: unknown } | null;
};

async function postJson(path: string, accessToken: string, deviceId: string | null | undefined, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Client-Request-ID': (body as any).event_id,
      ...(deviceId ? { 'X-Device-ID': deviceId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 200 && response.status !== 202) {
    const text = await response.text();
    throw new Error(`dispatch_event ingest failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function emitDispatchEvent(input: DispatchEventInput) {
  const now = new Date().toISOString();
  const payload = {
    event_id: uuidv4(),
    schema_version: '1.0.0',
    event_name: 'dispatch_event',
    event_ts_utc: input.event_ts_utc ?? now,
    client_ts: input.client_ts ?? now,
    source_system: 'field_app',
    project_id: input.project_id ?? 'purpulse.app',
    device_id: input.telemetry_consent?.device === false ? null : (input.device_id ?? null),
    session_id: input.session_id ?? null,
    job_id: input.job_id,
    dispatch_id: input.dispatch_id ?? null,
    technician_id: input.technician_id,
    site_id: input.site_id ?? null,
    connectivity_state: input.connectivity_state ?? 'unknown',
    telemetry_consent: input.telemetry_consent ?? { location: false, device: true },
    location: input.telemetry_consent?.location ? (input.location ?? null) : null,
    ...input,
  };

  delete (payload as any).accessToken;

  return postJson('/api/v1/telemetry/dispatch-events', input.accessToken, input.device_id, payload);
}

/*
Example payload:

{
  "event_id": "9c2c8b6b-1f0d-4b1c-8f48-01b52d9f2e2e",
  "schema_version": "1.0.0",
  "event_name": "dispatch_event",
  "event_ts_utc": "2026-03-18T14:05:22.000Z",
  "client_ts": "2026-03-18T14:05:20.111Z",
  "source_system": "field_app",
  "project_id": "purpulse.app",
  "device_id": "dev-a1b2c3",
  "session_id": "sess-abc123",
  "job_id": "job_123",
  "dispatch_id": "disp_456",
  "assignment_id": "asg_789",
  "technician_id": "tech_001",
  "site_id": "site_042",
  "status": "arrived",
  "accept_flag": true,
  "decline_flag": false,
  "offer_timestamp": "2026-03-18T13:11:00.000Z",
  "response_timestamp": "2026-03-18T13:12:08.000Z",
  "cancel_timestamp": null,
  "planned_eta_timestamp": "2026-03-18T14:15:00.000Z",
  "eta_ack_timestamp": "2026-03-18T13:20:00.000Z",
  "eta_update_timestamp": "2026-03-18T13:55:00.000Z",
  "route_departure_timestamp": "2026-03-18T13:25:00.000Z",
  "scheduled_start_timestamp": "2026-03-18T14:00:00.000Z",
  "connectivity_state": "cellular",
  "telemetry_consent": {
    "location": true,
    "device": true
  },
  "location": {
    "lat": 51.5074,
    "lon": -0.1278,
    "accuracy_m": 8.0
  }
}
*/
