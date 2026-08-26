/** Status color mapping */
export const STATUS_COLORS: Record<string, string> = {
  'Completed': 'bg-green-100 text-green-800',
  'On-Going': 'bg-blue-100 text-blue-800',
  'Not Yet Started': 'bg-gray-100 text-gray-800',
  'Terminated': 'bg-red-100 text-red-800',
  'Suspended': 'bg-amber-100 text-amber-800',
};

/** Severity color mapping */
export const SEVERITY_COLORS: Record<string, string> = {
  'low': 'bg-gray-100 text-gray-700',
  'medium': 'bg-amber-100 text-amber-700',
  'high': 'bg-orange-100 text-orange-700',
  'critical': 'bg-red-100 text-red-700',
};

/** Anomaly flag color mapping */
export const FLAG_COLORS: Record<string, string> = {
  'Stalled': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Never Started': 'bg-gray-100 text-gray-800 border-gray-300',
  'Overdue': 'bg-red-100 text-red-800 border-red-300',
  'Overpaid': 'bg-purple-100 text-purple-800 border-purple-300',
  'Payment Pending': 'bg-slate-100 text-slate-600 border-slate-300',
};

/** Project categories from real DPWH data */
export const PROJECT_CATEGORIES = [
  'All',
  'Roads',
  'Bridges',
  'Flood Control and Drainage',
  'Buildings and Facilities',
  'Water Provision and Storage',
] as const;

/** DPWH API base URL */
export const DPWH_API_BASE = 'https://api.transparency.dpwh.gov.ph/projects';

/** HuggingFace dataset API base URL */
export const HF_DATASET_API = 'https://datasets-server.huggingface.co/rows';
export const HF_DATASET_NAME = 'bettergovph/dpwh-transparency-data';

/** Rate limiting constants */
export const MAX_REPORTS_PER_PHONE_PER_PROJECT = 3;
export const MAX_REPORTS_PER_IP_PER_DAY = 10;
export const OTP_EXPIRY_MINUTES = 5;
export const DEMO_PHONE_NUMBER = '+639000000000';

/** Sync constants */
export const SYNC_DELAY_MS = 200;
export const SYNC_BATCH_SIZE = 1000;
