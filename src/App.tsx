import React, { ReactNode } from 'react'
import { Toaster } from '@/components/ui/toaster'
import FieldJobs from './pages/FieldJobs'
import FieldJobDetail from './pages/FieldJobDetail'
import AdminDevPanel from './pages/AdminDevPanel'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import PageNotFound from './lib/PageNotFound'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import UserNotRegisteredError from '@/components/UserNotRegisteredError'
import AuthErrorBoundary from '@/components/AuthErrorBoundary'
import ErrorBoundary from '@/components/ErrorBoundary'
import { initSentry } from '@/lib/sentry'
import TelemetryConsent from '@/components/TelemetryConsent'

// Initialize Sentry for error tracking
initSentry()

interface AuthErrorType {
  type: 'user_not_registered' | 'auth_required' | 'auth_error' | string
  message?: string
}

interface LayoutWrapperProps {
  children: ReactNode
  currentPageName: string
}

interface PagesConfig {
  Pages: Record<string, React.ComponentType>
  Layout?: React.ComponentType<LayoutWrapperProps>
  mainPage?: string
}

const { Pages, Layout, mainPage } = pagesConfig as PagesConfig
const mainPageKey = mainPage ?? Object.keys(Pages)[0]
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children, currentPageName }) =>
  Layout ? (
    <Layout currentPageName={currentPageName}>{children}</Layout>
  ) : (
    <>{children}</>
  )

interface UseAuthReturn {
  isLoadingAuth: boolean
  isLoadingPublicSettings: boolean
  authError: AuthErrorType | null
  navigateToLogin: () => void
}

const AuthenticatedApp: React.FC = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth() as UseAuthReturn

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />
    } else if (authError.type === 'auth_required' || authError.type === 'auth_error') {
      return <AuthErrorBoundary />
    }
    // offline_mode: allow app to continue in read-only state
  }

  // Render the main app
  return (
    <Routes>
      <Route
        path="/"
        element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        }
      />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      {/* ── New Field App v2 pages (no Layout shell) ── */}
      <Route path="/FieldJobs" element={<FieldJobs />} />
      <Route path="/FieldJobDetail" element={<FieldJobDetail />} />
      <Route
        path="/AdminDevPanel"
        element={
          <LayoutWrapper currentPageName="AdminDevPanel">
            <AdminDevPanel />
          </LayoutWrapper>
        }
      />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

const App: React.FC = () => {
  // Attach retry interceptor to axios
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/api/base44Client').then(({ base44 }) => {
        // Retry interceptor will be attached to the underlying axios instance
      })
    }
  }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <TelemetryConsent />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App