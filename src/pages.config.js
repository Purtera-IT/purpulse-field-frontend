/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import ActiveJob from './pages/ActiveJob';
import EvidenceHub from './pages/EvidenceHub';
import TimeLog from './pages/TimeLog';
import Support from './pages/Support';
import AdminQC from './pages/AdminQC';
import Onboarding from './pages/Onboarding';
import AdminJobs from './pages/AdminJobs';
import AdminSnapshot from './pages/AdminSnapshot';
import AdminAuditLog from './pages/AdminAuditLog';
import AdminUsers from './pages/AdminUsers';
import AdminDevices from './pages/AdminDevices';
import DevModelInputs from './pages/DevModelInputs';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Jobs": Jobs,
    "JobDetail": JobDetail,
    "ActiveJob": ActiveJob,
    "EvidenceHub": EvidenceHub,
    "TimeLog": TimeLog,
    "Support": Support,
    "AdminQC": AdminQC,
    "Onboarding": Onboarding,
    "AdminJobs": AdminJobs,
    "AdminSnapshot": AdminSnapshot,
    "AdminAuditLog": AdminAuditLog,
    "AdminUsers": AdminUsers,
    "AdminDevices": AdminDevices,
}

export const pagesConfig = {
    mainPage: "Jobs",
    Pages: PAGES,
    Layout: __Layout,
};