import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import 'leaflet/dist/leaflet.css'
import { registerTelemetryQueueListeners } from '@/lib/telemetryQueue'

registerTelemetryQueueListeners()

// Initialize MSW in development
if (process.env.NODE_ENV === 'development') {
  import('@/mocks/browser').then(({ worker }) => {
    worker.start({
      onUnhandledRequest: 'bypass',
    }).catch(err => console.warn('[MSW] Worker setup failed, using fallback mock data:', err));
  }).catch(err => console.warn('[MSW] Import failed:', err));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)