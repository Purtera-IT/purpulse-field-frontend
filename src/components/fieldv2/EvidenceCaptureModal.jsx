/**
 * EvidenceCaptureModal — Evidence capture / upload (D)
 * Camera/gallery selection, preview, step selector, notes, progress.
 * Calls adapter.requestUploadToken() → fake upload → adapter.completeUpload()
 * Then creates a manifest row.
 */
import React, { useState, useRef } from 'react';
import { X, Camera, Images, RotateCw, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uuidv4 } from '@/lib/uuid';
import { defaultAdapters } from '@/lib/fieldAdapters';

const EVIDENCE_TYPES = ['before_photo','after_photo','equipment_label','site_photo','general'];

async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function fakeProgress(onProgress) {
  return new Promise(resolve => {
    let p = 0;
    const id = setInterval(() => {
      p = Math.min(p + Math.random() * 18 + 8, 95);
      onProgress(Math.round(p));
      if (p >= 95) { clearInterval(id); resolve(); }
    }, 150);
  });
}

export default function EvidenceCaptureModal({
  jobId, stepId, adapter = defaultAdapters.upload,
  onClose, onSuccess
}) {
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [evType,   setEvType]   = useState('general');
  const [notes,    setNotes]    = useState('');
  const [progress, setProgress] = useState(0);
  const [phase,    setPhase]    = useState('select'); // select | preview | uploading | done
  const [rotation, setRotation] = useState(0);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
    setPhase('preview');
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase('uploading');
    setProgress(0);

    const sha256 = await hashFile(file).catch(() => 'sha256-placeholder-' + uuidv4().slice(0,8));
    const token  = await adapter.requestUploadToken(file, jobId, stepId);

    await fakeProgress(setProgress);
    setProgress(100);

    const evidenceId = uuidv4();
    const nowIso     = new Date().toISOString();

    const evidenceData = {
      id:              evidenceId,
      job_id:          jobId,
      evidence_type:   evType,
      file_url:        preview,
      content_type:    file.type,
      size_bytes:      file.size,
      sha256,
      captured_at:     nowIso,
      status:          'uploaded',
      runbook_step_id: stepId || null,
      notes:           notes || undefined,
      approved_for_training: false,
    };

    const record = await adapter.completeUpload(token, evidenceData);

    await adapter.createManifestRow({
      job_id:            jobId,
      evidence_id:       record.id || evidenceId,
      filename:          file.name,
      sha256,
      file_url:          preview,
      azure_blob_url:    token.upload_url,
      content_type:      file.type,
      size_bytes:        file.size,
      capture_ts:        nowIso,
      upload_ts:         nowIso,
      evidence_type:     evType,
      runbook_step_id:   stepId || null,
      sync_status:       'synced',
      azure_indexed:     false,
      approved_for_training: false,
    }).catch(() => {});

    setPhase('done');
    toast.success('Evidence uploaded and manifest created');
    setTimeout(() => onSuccess?.(), 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl pb-safe-area overflow-hidden">
        {/* Handle */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <h2 className="text-base font-black text-slate-900">
            {phase === 'select' ? 'Add Evidence' : phase === 'preview' ? 'Review' : phase === 'uploading' ? 'Uploading…' : 'Done!'}
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-4">
          {/* SELECT */}
          {phase === 'select' && (
            <div className="space-y-3">
              <input ref={inputRef} type="file" accept="image/*,video/*,application/pdf" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />
              <button onClick={() => { inputRef.current.setAttribute('capture','environment'); inputRef.current.click(); }}
                className="w-full h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-98 transition">
                <Camera className="h-6 w-6" />
                <div className="text-left"><p className="font-bold text-sm">Camera</p><p className="text-xs text-white/60">Capture photo or video</p></div>
              </button>
              <button onClick={() => { inputRef.current.removeAttribute('capture'); inputRef.current.click(); }}
                className="w-full h-14 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-200 active:scale-98 transition">
                <Images className="h-5 w-5 text-slate-500" />
                <div className="text-left"><p className="font-semibold text-sm">Gallery / File</p><p className="text-xs text-slate-400">Photo, video, or PDF</p></div>
              </button>
            </div>
          )}

          {/* PREVIEW */}
          {phase === 'preview' && (
            <div className="space-y-3">
              {preview && file?.type?.startsWith('image') && (
                <div className="relative rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center h-52">
                  <img src={preview} alt="preview"
                    className="h-full w-full object-contain transition-transform"
                    style={{ transform: `rotate(${rotation}deg)` }} />
                  <button onClick={() => setRotation(r => (r + 90) % 360)}
                    className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm">
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
              )}
              {!file?.type?.startsWith('image') && (
                <div className="h-20 bg-slate-50 rounded-xl flex items-center justify-center gap-2 text-slate-500 text-sm font-medium">
                  📎 {file?.name}
                </div>
              )}

              {/* Meta */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Evidence Type</label>
                <select value={evType} onChange={e => setEvType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold px-3 focus:outline-none focus:ring-1 focus:ring-slate-400 capitalize">
                  {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Add context for this evidence…"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setFile(null); setPreview(null); setPhase('select'); }}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                  Retake
                </button>
                <button onClick={handleUpload}
                  className="flex-1 h-10 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-700">
                  <Upload className="h-4 w-4" /> Upload
                </button>
              </div>
            </div>
          )}

          {/* UPLOADING */}
          {phase === 'uploading' && (
            <div className="py-6 flex flex-col items-center gap-4">
              <div className="relative h-16 w-16">
                <Loader2 className="h-16 w-16 text-slate-200 animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-400">Creating manifest row…</p>
            </div>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="font-black text-slate-900">Uploaded successfully</p>
              <p className="text-xs text-slate-400">Evidence record and manifest row created.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}