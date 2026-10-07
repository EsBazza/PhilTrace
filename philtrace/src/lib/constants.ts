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

/** ESRI Wayback MapServer release identifiers */
export const ESRI_WAYBACK_CATALOG: Record<number, { m: string; itemId: string; name: string; releaseDate: string }> = {
  2014: { m: '5844', itemId: '109', name: 'WB_2014_R21', releaseDate: '2014-12-30' },
  2015: { m: '28163', itemId: '124', name: 'WB_2015_R23', releaseDate: '2015-12-16' },
  2016: { m: '18966', itemId: '177', name: 'WB_2016_R22', releaseDate: '2016-12-20' },
  2017: { m: '25521', itemId: '233', name: 'WB_2017_R19', releaseDate: '2017-11-16' },
  2018: { m: '23448', itemId: '1099', name: 'WB_2018_R17', releaseDate: '2018-12-14' },
  2019: { m: '4756', itemId: '2093', name: 'WB_2019_R16', releaseDate: '2019-12-12' },
  2020: { m: '29260', itemId: '3023', name: 'WB_2020_R16', releaseDate: '2020-12-16' },
  2021: { m: '26120', itemId: '4038', name: 'WB_2021_R17', releaseDate: '2021-12-21' },
  2022: { m: '45134', itemId: '5047', name: 'WB_2022_R15', releaseDate: '2022-12-14' },
  2023: { m: '56102', itemId: '6059', name: 'WB_2023_R11', releaseDate: '2023-12-07' },
  2024: { m: '16453', itemId: '7085', name: 'WB_2024_R13', releaseDate: '2024-12-12' },
  2025: { m: '13192', itemId: '8112', name: 'WB_2025_R12', releaseDate: '2025-12-18' },
  2026: { m: '26334', itemId: '9120', name: 'WB_2026_R07', releaseDate: '2026-08-05' },
};
