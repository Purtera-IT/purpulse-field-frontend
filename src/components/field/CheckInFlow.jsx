import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Loader2, Navigation, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { emitDispatchEventForJobStatusChange } from '@/lib/dispatchEvent';

export default function CheckInFlow({ job, onCheckIn }) {
  const [step, setStep] = useState('initial');
  const [geoStatus, setGeoStatus] = useState(null);
  const [manualReason, setManualReason] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const checkInMutation = useMutation({
    mutationFn: async (data) => {
      const location =
        data.lat != null && data.lon != null
          ? { lat: data.lat, lon: data.lon, accuracy_m: data.accuracyM }
          : null;
      await emitDispatchEventForJobStatusChange({
        job,
        targetAppStatus: 'checked_in',
        user,
        location,
      });
      await base44.entities.Job.update(job.id, {
        status: 'checked_in',
        check_in_time: new Date().toISOString(),
        check_in_method: data.method,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Checked in successfully');
      onCheckIn?.();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Check-in failed');
    },
  });

  const attemptGPS = () => {
    setStep('gps');
    setGeoStatus('locating');

    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      setStep('manual');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus('success');
        checkInMutation.mutate({
          method: 'gps',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        setGeoStatus('failed');
        setStep('manual');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleManualCheckIn = () => {
    if (!manualReason.trim()) {
      toast.error('Please provide a reason for manual check-in');
      return;
    }
    checkInMutation.mutate({
      method: 'manual',
      manualReason: manualReason.trim(),
    });
  };

  if (job.status !== 'assigned' && job.status !== 'en_route') return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <div className="text-center">
        <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <MapPin className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="font-semibold text-slate-900">Check In to Job Site</h3>
        <p className="text-xs text-slate-500 mt-1">{job.site_address || job.site_name}</p>
      </div>

      {step === 'initial' && (
        <Button
          className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
          onClick={attemptGPS}
          disabled={checkInMutation.isPending}
        >
          <Navigation className="h-4 w-4 mr-2" />
          Check In with GPS
        </Button>
      )}

      {step === 'gps' && geoStatus === 'locating' && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Getting your location...
        </div>
      )}

      {step === 'manual' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>GPS unavailable. Please provide a reason for manual check-in.</span>
          </div>
          <Textarea
            placeholder="Reason for manual check-in (e.g., indoors, no GPS signal)..."
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
          />
          <Button
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
            onClick={handleManualCheckIn}
            disabled={checkInMutation.isPending}
          >
            {checkInMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Manual Check-In
          </Button>
        </div>
      )}
    </div>
  );
}