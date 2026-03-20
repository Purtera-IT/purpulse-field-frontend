/**
 * GalleryImport
 * Multi-select gallery picker with batch tagging, quality selection, compress toggle.
 * Per-file metadata edit before queueing.
 */
import React, { useRef, useState } from 'react';
import { Images, X, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import EvidenceMetadataForm from './EvidenceMetadataForm';

const BATCH_TAGS = ['Before', 'After', 'Serial', 'Rack', 'Cable', 'Damage', 'Label'];
const QUALITY_OPTIONS = [
  { value: 'high',   label: 'High',   desc: 'Original',  color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { value: 'medium', label: 'Med',    desc: '~75%',      color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'low',    label: 'Low',    desc: '~40%',      color: 'bg-slate-100 text-slate-600 border-slate-300' },
];

export default function GalleryImport({ jobId, onQueueAll, onBack }) {
  const fileInputRef       = useRef(null);
  const [files, setFiles]  = useState([]); // [{ id, file, previewUrl, selected, tags, note }]
  const [batchTags, setBatchTags]   = useState([]);
  const [quality, setQuality]       = useState('high');
  const [compress, setCompress]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [showBatchTag, setShowBatchTag] = useState(false);

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    const newFiles = selected.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      selected: true,
      tags: [],
      note: '',
    }));
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const toggleSelect = id => setFiles(prev => prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  const selectAll    = ()  => setFiles(prev => prev.map(f => ({ ...f, selected: true })));
  const deselectAll  = ()  => setFiles(prev => prev.map(f => ({ ...f, selected: false })));
  const removeFile   = id  => setFiles(prev => {
    const f = prev.find(x => x.id === id);
    if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
    return prev.filter(x => x.id !== id);
  });

  const toggleBatchTag = tag => {
    setBatchTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const applyBatchTags = () => {
    setFiles(prev => prev.map(f =>
      f.selected
        ? { ...f, tags: [...new Set([...f.tags, ...batchTags])] }
        : f
    ));
    setShowBatchTag(false);
    setBatchTags([]);
  };

  const updateFileMeta = (id, metadata) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, tags: metadata.tags.map(t => t.charAt(0).toUpperCase() + t.slice(1)), note: metadata.note, metadata } : f
    ));
    setEditingId(null);
  };

  const selectedFiles = files.filter(f => f.selected);

  const handleQueueAll = () => {
    if (!selectedFiles.length) return;
    const items = selectedFiles.map(f => ({
      file: f.file,
      metadata: {
        tags: f.tags.map(t => t.toLowerCase()),
        note: f.note,
        quality,
        compress,
        capture_ts: new Date().toISOString(),
        face_blur: true,
        ...(f.metadata || {}),
      },
    }));
    onQueueAll(items);
  };

  // Per-file metadata edit view
  if (editingId) {
    const f = files.find(x => x.id === editingId);
    if (!f) { setEditingId(null); return null; }
    return (
      <EvidenceMetadataForm
        previewUrl={f.previewUrl}
        defaultTags={f.tags}
        onSubmit={(meta) => updateFileMeta(editingId, meta)}
        onBack={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">

      {/* Pick files */}
      {files.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 active:bg-slate-50"
        >
          <Images className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Tap to select photos</p>
          <p className="text-xs text-slate-400">Multiple selection supported</p>
        </button>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2 active:bg-slate-50"
        >
          <Images className="h-4 w-4" /> Add More Photos
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />

      {files.length > 0 && (
        <>
          {/* Select controls */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-semibold">
              {selectedFiles.length} of {files.length} selected
            </p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-blue-600 font-semibold">All</button>
              <button onClick={deselectAll} className="text-xs text-slate-400 font-semibold">None</button>
            </div>
          </div>

          {/* File grid */}
          <div className="grid grid-cols-3 gap-2">
            {files.map(f => (
              <div key={f.id} className="relative">
                <button
                  onClick={() => toggleSelect(f.id)}
                  className={cn('w-full aspect-square rounded-xl overflow-hidden block', f.selected && 'ring-2 ring-slate-900 ring-offset-1')}
                >
                  <img src={f.previewUrl} alt="preview" className="w-full h-full object-cover" />
                  {/* Tag chips overlay */}
                  {f.tags.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                      <p className="text-white text-[9px] font-bold truncate">{f.tags.join(' · ')}</p>
                    </div>
                  )}
                  <div className="absolute top-1 left-1">
                    {f.selected
                      ? <div className="h-5 w-5 rounded-full bg-slate-900 flex items-center justify-center"><svg viewBox="0 0 12 10" className="h-2.5 w-2.5 fill-none stroke-white stroke-2"><polyline points="1,5 4,8 11,1"/></svg></div>
                      : <div className="h-5 w-5 rounded-full bg-white/80 border border-slate-300" />
                    }
                  </div>
                </button>
                {/* Per-file actions */}
                <div className="absolute top-1 right-1 flex flex-col gap-1">
                  <button onClick={() => setEditingId(f.id)}
                    className="h-5 w-5 rounded-md bg-white/80 flex items-center justify-center text-[9px] font-bold text-slate-700">
                    ✏️
                  </button>
                  <button onClick={() => removeFile(f.id)}
                    className="h-5 w-5 rounded-md bg-white/80 flex items-center justify-center">
                    <X className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Batch tag section */}
          <div>
            <button
              onClick={() => setShowBatchTag(!showBatchTag)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 text-sm font-semibold text-slate-700"
            >
              <span>Batch Tag ({selectedFiles.length} selected)</span>
              {showBatchTag ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showBatchTag && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {BATCH_TAGS.map(tag => (
                    <button key={tag} onClick={() => toggleBatchTag(tag)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                        batchTags.includes(tag) ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <button onClick={applyBatchTags} disabled={batchTags.length === 0}
                  className="w-full h-9 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-40"
                >
                  Apply to Selected
                </button>
              </div>
            )}
          </div>

          {/* Quality + compress */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quality</p>
            <div className="flex gap-2">
              {QUALITY_OPTIONS.map(q => (
                <button key={q.value} onClick={() => setQuality(q.value)}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all',
                    quality === q.value ? q.color : 'bg-white text-slate-400 border-slate-200'
                  )}
                >
                  {q.label}
                  <span className="block text-[10px] font-normal opacity-60">{q.desc}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setCompress(!compress)}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <div className={cn('h-5 w-9 rounded-full transition-colors relative', compress ? 'bg-slate-900' : 'bg-slate-200')}>
                <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', compress ? 'translate-x-4' : 'translate-x-0.5')} />
              </div>
              <span className="font-medium">Compress before upload</span>
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <button onClick={onBack}
              className="h-12 px-5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm"
            >
              Back
            </button>
            <button onClick={handleQueueAll} disabled={selectedFiles.length === 0}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm disabled:opacity-40 active:opacity-80 flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Queue {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {files.length === 0 && (
        <button onClick={onBack} className="w-full text-xs text-slate-400 font-semibold py-2">
          ← Back
        </button>
      )}
    </div>
  );
}