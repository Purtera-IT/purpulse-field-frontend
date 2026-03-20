/**
 * TutorialSlides
 * Step 4 — interactive tutorial with micro-interactions.
 *
 * Slides:
 *   1. One-hand capture — tap the shutter button demo (animated)
 *   2. Timer start/stop — tap play/stop demo
 *   3. Swipe to navigate jobs — swipe gesture demo
 *   4. Quick Actions bar — shows the 5 quick actions
 *   5. You're ready! 🎉
 *
 * Each slide has:
 *   - A live interactive demo (tap to trigger animation)
 *   - Brief text
 *   - Progress dots
 *   - Skip + Next controls
 */
import React, { useState } from 'react';
import { Camera, Play, Square, Coffee, Car, ChevronRight, Check, Zap, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Interactive demo components ───────────────────────────────────────

function CaptureDemo() {
  const [firing, setFire] = useState(false);
  const trigger = () => {
    setFire(true);
    setTimeout(() => setFire(false), 600);
  };
  return (
    <div className="flex flex-col items-center justify-center h-52 bg-slate-900 rounded-3xl relative overflow-hidden">
      <div className={cn('absolute inset-0 bg-white transition-opacity duration-100', firing ? 'opacity-40' : 'opacity-0')} />
      {/* Viewfinder corners */}
      <div className="absolute inset-4 pointer-events-none">
        {['tl','tr','bl','br'].map(c => (
          <div key={c} className={cn('absolute h-5 w-5 border-white border-2',
            c === 'tl' ? 'top-0 left-0 border-r-0 border-b-0 rounded-tl-md' :
            c === 'tr' ? 'top-0 right-0 border-l-0 border-b-0 rounded-tr-md' :
            c === 'bl' ? 'bottom-0 left-0 border-r-0 border-t-0 rounded-bl-md' :
                          'bottom-0 right-0 border-l-0 border-t-0 rounded-br-md'
          )} />
        ))}
      </div>
      <p className="text-white/50 text-xs mb-8">Tap the shutter →</p>
      <button
        onClick={trigger}
        className={cn('h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90',
          firing ? 'scale-90 bg-white/20' : 'bg-transparent'
        )}
        aria-label="Shutter"
      >
        <div className={cn('h-12 w-12 rounded-full transition-colors', firing ? 'bg-white' : 'bg-white/80')} />
      </button>
    </div>
  );
}

function TimerDemo() {
  const [running, setRunning] = useState(false);
  const [secs, setSecs]       = useState(0);
  const ref = React.useRef(null);

  const toggle = () => {
    if (running) {
      clearInterval(ref.current);
      setRunning(false);
    } else {
      setRunning(true);
      ref.current = setInterval(() => setSecs(s => s + 1), 1000);
    }
  };
  React.useEffect(() => () => clearInterval(ref.current), []);

  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center h-52 bg-emerald-50 rounded-3xl gap-5">
      <p className="text-5xl font-black text-emerald-800 tabular-nums font-mono">{h}:{m}:{s}</p>
      <button onClick={toggle}
        className={cn('h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90',
          running ? 'bg-red-500' : 'bg-emerald-600'
        )}
      >
        {running
          ? <Square className="h-6 w-6 text-white fill-white" />
          : <Play className="h-6 w-6 text-white fill-white ml-1" />
        }
      </button>
      <p className="text-xs text-emerald-600 font-semibold">{running ? 'Tap to stop' : 'Tap to start'}</p>
    </div>
  );
}

function SwipeDemo() {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = React.useRef(null);

  const onStart = (e) => { startX.current = e.touches?.[0]?.clientX ?? e.clientX; setDragging(true); };
  const onMove  = (e) => {
    if (startX.current == null) return;
    const dx = (e.touches?.[0]?.clientX ?? e.clientX) - startX.current;
    setOffset(Math.max(-90, Math.min(90, dx)));
  };
  const onEnd   = () => { setOffset(0); setDragging(false); startX.current = null; };

  return (
    <div className="flex flex-col items-center justify-center h-52 bg-slate-100 rounded-3xl gap-3 overflow-hidden relative">
      <div
        className={cn('w-64 bg-white rounded-2xl shadow-lg p-4 transition-transform cursor-grab active:cursor-grabbing select-none',
          !dragging && 'transition-all duration-300'
        )}
        style={{ transform: `translateX(${offset}px) rotate(${offset * 0.05}deg)` }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      >
        <p className="text-sm font-black text-slate-900">Fiber Install — 123 Main St</p>
        <p className="text-xs text-slate-400 mt-0.5">Tap or swipe ←→</p>
        <div className="flex items-center gap-2 mt-3">
          <ArrowLeft className="h-4 w-4 text-blue-500" />
          <span className="text-[10px] text-slate-400 flex-1 text-center">Navigate</span>
          <ArrowRight className="h-4 w-4 text-emerald-500" />
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1 text-blue-600 font-semibold"><ArrowLeft className="h-3 w-3" /> Open Maps</span>
        <span className="flex items-center gap-1 text-emerald-600 font-semibold">Start Timer <ArrowRight className="h-3 w-3" /></span>
      </div>
    </div>
  );
}

function QuickActionsDemo() {
  const [active, setActive] = useState(null);
  const ACTIONS = [
    { key: 'photo',  icon: Camera,  label: 'Photo',  color: 'bg-blue-500'   },
    { key: 'timer',  icon: Play,    label: 'Timer',  color: 'bg-emerald-500' },
    { key: 'break',  icon: Coffee,  label: 'Break',  color: 'bg-amber-500'  },
    { key: 'travel', icon: Car,     label: 'Travel', color: 'bg-purple-500' },
    { key: 'more',   icon: Zap,     label: 'More',   color: 'bg-slate-500'  },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-52 bg-white rounded-3xl gap-4">
      <p className="text-xs text-slate-500 font-semibold">Tap any quick action:</p>
      <div className="flex gap-3">
        {ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.key} onClick={() => setActive(a.key)}
              className={cn('flex flex-col items-center gap-1 transition-all',
                active === a.key ? 'scale-110' : 'scale-100'
              )}
            >
              <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shadow-md transition-all',
                active === a.key ? a.color + ' scale-110' : 'bg-slate-100'
              )}>
                <Icon className={cn('h-5 w-5', active === a.key ? 'text-white' : 'text-slate-500')} />
              </div>
              <span className={cn('text-[10px] font-semibold', active === a.key ? 'text-slate-900' : 'text-slate-400')}>{a.label}</span>
            </button>
          );
        })}
      </div>
      {active && <p className="text-xs text-slate-600 font-semibold animate-pulse">✓ {active.charAt(0).toUpperCase() + active.slice(1)} opened!</p>}
    </div>
  );
}

const SLIDES = [
  {
    title: 'One-hand capture',
    body: 'The shutter is at the bottom of the screen — reachable with one thumb. Tap to capture evidence without shifting your grip.',
    demo: <CaptureDemo />,
  },
  {
    title: 'Start & stop the timer',
    body: 'Tap Play on any job to start tracking work time. Tap Stop when you\'re done. Breaks and travel are tracked separately.',
    demo: <TimerDemo />,
  },
  {
    title: 'Swipe to act',
    body: 'Swipe job cards left to open Maps or right to start the timer instantly — no need to open the full job detail.',
    demo: <SwipeDemo />,
  },
  {
    title: 'Quick actions bar',
    body: 'Inside every job you\'ll find quick actions for Photos, Timer, Break, Travel, and more — all reachable with one tap.',
    demo: <QuickActionsDemo />,
  },
  {
    title: "You're all set! 🎉",
    body: 'You know the basics. Open your first job from the Jobs tab and get started. Your dispatcher is available in the chat if you need help.',
    demo: (
      <div className="flex flex-col items-center justify-center h-52 bg-gradient-to-br from-slate-900 to-slate-700 rounded-3xl gap-3">
        <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center">
          <Check className="h-10 w-10 text-white" />
        </div>
        <p className="text-white font-black text-lg">Ready for the field</p>
      </div>
    ),
  },
];

export default function TutorialSlides({ onDone }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <div className="space-y-6">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={cn('transition-all rounded-full', i === idx ? 'h-2 w-6 bg-slate-900' : 'h-2 w-2 bg-slate-200')}
          />
        ))}
      </div>

      {/* Demo */}
      {slide.demo}

      {/* Text */}
      <div>
        <h2 className="text-xl font-black text-slate-900">{slide.title}</h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{slide.body}</p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)}
            className="h-14 px-5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold text-sm active:bg-slate-50"
          >
            Back
          </button>
        )}
        <button
          onClick={isLast ? onDone : () => setIdx(i => i + 1)}
          className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-bold text-base active:opacity-80 flex items-center justify-center gap-2"
        >
          {isLast ? <><Check className="h-5 w-5" /> Go to Jobs</> : <>Next <ChevronRight className="h-5 w-5" /></>}
        </button>
      </div>

      {!isLast && (
        <button onClick={onDone} className="w-full text-center text-xs text-slate-400 font-semibold py-1">
          Skip tutorial
        </button>
      )}
    </div>
  );
}