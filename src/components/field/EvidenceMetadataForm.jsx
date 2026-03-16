/**
 * EvidenceMetadataForm
 * Minimal-typing metadata screen after image capture.
 * Tags as chips, voice note, auto GPS with override, face-blur toggle, "More" expander.
 */
import React, { useState, useEffect } from 'react';
import { MapPin, Mic, MicOff, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const QUICK_TAGS = ['Before', 'After', 'Serial', 'Rack', 'Cable', 'Damage', 'Label', 'Wide'];

export default function EvidenceMetadataForm({ previewUrl, defaultTags = [], onSubmit, onBack }) {
  const [tags, setTags]                         = useState(defaultTags);
  const [note, setNote]                         = useState('');
  const [faceBlur, setFaceBlur]                 = useState(true);
  const [gps, setGps]                           = useState(null);
  const [gpsOverride, setGpsOverride]           = useState(false);
  const [gpsLat, setGpsLat]                     = useState('');
  const [gpsLon, setGpsLon]                     = useState('');
  const [showMore, setShowMore]                 = useState(false);
  const [serialNum, setSerialNum]               = useState('');
  const [partNum, setPartNum]                   = useState('');
  const [powerOff, setPowerOff]                 = useState(false);
  const [isListening, setIsListening]           = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => {}
    );
  }, []);

  const toggleTag = t => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.info('Voice input not available on this device'); return; }
    const sr = new SR();
    sr.continuous = false;
    sr.lang = 'en-US';
    sr.onresult = e => { setNote(p => (p + ' ' + e.results[0][0].transcript).trimStart()); setIsListening(false); };
    sr.onerror = () => { setIsListening(false); toast.error('Voice recognition error'); };
    sr.onend = () => setIsListening(false);
    sr.start();
    setIsListening(true);
  };

  const handleSubmit = () => {
    const lat = gpsOverride ? parseFloat(gpsLat) || null : gps?.lat || null;
    const lon = gpsOverride ? parseFloat(gpsLon) || null : gps?.lon || null;

    // Metadata payload — mirrors example evidence metadata spec
    const metadata = {
      client_event_id: 'evt-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      tags: tags.map(t => t.toLowerCase()),
      note: note.trim(),
      face_blur: faceBlur,
      capture_ts: new Date().toISOString(),
      lat, lon,
      gps_accuracy: gps?.accuracy || null,
      gps_overridden: gpsOverride,
      serial_number: serialNum.trim() || null,
      part_number: partNum.trim() || null,
      power_off_confirmed: powerOff,
    };

    console.info('[Purpulse][Evidence] metadata payload:', JSON.stringify(metadata, null, 2));
    onSubmit(metadata);
  };

  return (
    <div className="space-y-4">

      {/* Preview */}
      {previewUrl && (
        <div className="relative rounded-2xl overflow-hidden h-44 bg-slate-900">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          {faceBlur && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              😶 Blur ON
            </div>
          )}
          {gps && !gpsOverride && (
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              {gps.lat.toFixed(4)}, {gps.lon.toFixed(4)} ±{gps.accuracy}m
            </div>
          )}
        </div>
      )}

      {/* Quick tag chips */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tags <span className="text-red-400">*</span></p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag} onClick={() => toggleTag(tag)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95',
                tags.includes(tag) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Note + mic */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Note</p>
        <div className="relative">
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Describe what's captured…"
            className="w-full h-20 rounded-xl border border-slate-200 p-3 pr-11 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            onClick={startVoice}
            className={cn(
              'absolute right-2 bottom-2 h-8 w-8 rounded-full flex items-center justify-center transition-colors',
              isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-100'
            )}
            aria-label={isListening ? 'Stop recording' : 'Start voice input'}
          >
            {isListening ? <Mic className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-slate-500" />}
          </button>
        </div>
        {isListening && <p className="text-xs text-red-500 mt-1 animate-pulse">Listening…</p>}
      </div>

      {/* GPS + face-blur */}
      <div className="flex gap-2">
        <div className="flex-1 bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">GPS</p>
          {gps ? (
            <>
              <p className="text-xs font-mono text-slate-700 leading-snug">
                {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
              </p>
              <p className="text-[10px] text-slate-400">±{gps.accuracy}m accuracy</p>
              <button onClick={() => setGpsOverride(!gpsOverride)} className="text-[10px] text-blue-600 font-semibold mt-1">
                {gpsOverride ? '← Use device GPS' : 'Override (audit)'}
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-400 animate-pulse">Locating…</p>
          )}
          {gpsOverride && (
            <div className="mt-2 flex gap-1.5">
              <input value={gpsLat} onChange={e => setGpsLat(e.target.value)}
                placeholder="Lat" className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none"
              />
              <input value={gpsLon} onChange={e => setGpsLon(e.target.value)}
                placeholder="Lon" className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Face-blur toggle */}
        <button
          onClick={() => setFaceBlur(!faceBlur)}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 rounded-xl px-3 min-w-[76px] transition-colors',
            faceBlur ? 'bg-blue-50' : 'bg-slate-50'
          )}
          aria-label={`Face blur ${faceBlur ? 'on' : 'off'}`}
          aria-pressed={faceBlur}
        >
          <span className="text-2xl leading-none">{faceBlur ? '😶' : '🙂'}</span>
          <span className={cn('text-[10px] font-bold', faceBlur ? 'text-blue-700' : 'text-slate-400')}>
            {faceBlur ? 'Blur ON' : 'Blur OFF'}
          </span>
        </button>
      </div>

      {/* More expander */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 font-semibold py-1"
      >
        {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showMore ? 'Fewer options' : 'More options'}
      </button>

      {showMore && (
        <div className="space-y-3 bg-slate-50 rounded-2xl p-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Serial Number</p>
            <input value={serialNum} onChange={e => setSerialNum(e.target.value)}
              placeholder="e.g. SN-1234-XYZ"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Part Number</p>
            <input value={partNum} onChange={e => setPartNum(e.target.value)}
              placeholder="e.g. PN-9876"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <button
            onClick={() => setPowerOff(!powerOff)}
            className="flex items-center gap-3 w-full py-1"
            role="checkbox" aria-checked={powerOff}
          >
            <div className={cn('h-6 w-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              powerOff ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white')}>
              {powerOff && <svg viewBox="0 0 12 10" className="h-3 w-3 fill-none stroke-white stroke-2"><polyline points="1,5 4,8 11,1"/></svg>}
            </div>
            <span className="text-sm text-slate-700 font-medium">Power-off confirmed</span>
          </button>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-1">
        <button onClick={onBack}
          className="h-12 px-5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm active:opacity-70"
        >
          Back
        </button>
        <button onClick={handleSubmit} disabled={tags.length === 0}
          className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm disabled:opacity-40 active:opacity-80"
        >
          Add to Queue
        </button>
      </div>
    </div>
  );
}