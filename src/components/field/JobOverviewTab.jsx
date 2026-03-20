import React from 'react';
import { StatusBadge, PriorityIndicator } from './StatusBadge';
import CheckInFlow from './CheckInFlow';
import TimeTracker from './TimeTracker';
import { MapPin, Phone, Mail, User, Building2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function JobOverviewTab({ job }) {
  const isActive = ['checked_in', 'in_progress', 'paused'].includes(job.status);
  const needsCheckIn = ['assigned', 'en_route'].includes(job.status);

  return (
    <div className="space-y-4">
      {needsCheckIn && <CheckInFlow job={job} />}

      {isActive && <TimeTracker jobId={job.id} />}

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg text-slate-900">{job.title}</h2>
            {job.project_name && <p className="text-sm text-slate-500">{job.project_name}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={job.status} />
            <PriorityIndicator priority={job.priority} />
          </div>
        </div>

        {job.description && (
          <p className="text-sm text-slate-600 leading-relaxed">{job.description}</p>
        )}

        {job.scheduled_date && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            {format(new Date(job.scheduled_date), 'EEEE, MMMM d, yyyy')}
            {job.scheduled_time && ` at ${job.scheduled_time}`}
          </div>
        )}
      </div>

      {(job.site_name || job.site_address) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Site</p>
          {job.site_name && (
            <div className="flex items-center gap-2 text-sm text-slate-900 font-medium mb-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              {job.site_name}
            </div>
          )}
          {job.site_address && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(job.site_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline-offset-2 hover:underline"
              >
                {job.site_address}
              </a>
            </div>
          )}
        </div>
      )}

      {(job.contact_name || job.contact_phone || job.contact_email) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Contact</p>
          <div className="space-y-2">
            {job.contact_name && (
              <div className="flex items-center gap-2 text-sm text-slate-900">
                <User className="h-4 w-4 text-slate-400" />
                {job.contact_name}
              </div>
            )}
            {job.contact_phone && (
              <a href={`tel:${job.contact_phone}`} className="flex items-center gap-2 text-sm text-blue-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {job.contact_phone}
              </a>
            )}
            {job.contact_email && (
              <a href={`mailto:${job.contact_email}`} className="flex items-center gap-2 text-sm text-blue-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {job.contact_email}
              </a>
            )}
          </div>
        </div>
      )}

      {job.qc_status && (
        <div className={`rounded-2xl border p-4 ${
          job.qc_status === 'passed' ? 'bg-emerald-50 border-emerald-200' :
          job.qc_status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <p className="text-xs font-medium uppercase tracking-wide mb-1">QC Status</p>
          <p className="text-sm font-semibold capitalize">{job.qc_status}</p>
          {job.qc_fail_reasons && <p className="text-xs mt-1">{job.qc_fail_reasons}</p>}
        </div>
      )}
    </div>
  );
}