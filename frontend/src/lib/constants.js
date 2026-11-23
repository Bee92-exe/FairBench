/**
 * Application Constants
 * Aligns with SRS, PRD, and API_SPEC
 */

export const LAB_TIMEZONE = 'Asia/Dhaka';

export const MACHINES = [
  {
    id: 'm-microscope',
    name: 'Confocal Microscope',
    code: 'MIC-01',
    description: 'High-resolution fluorescence and 3D optical sectioning.',
    bufferMin: 15,
    status: 'operational',
    warning: null,
    icon: 'Microscope'
  },
  {
    id: 'm-centrifuge',
    name: 'High-Speed Centrifuge',
    code: 'CEN-02',
    description: 'Floor model refrigerated centrifuge up to 26,000 RPM.',
    bufferMin: 15,
    status: 'operational',
    warning: null,
    icon: 'Disc'
  },
  {
    id: 'm-spectrophotometer',
    name: 'UV-Vis Spectrophotometer',
    code: 'SPC-03',
    description: 'Dual-beam spectrophotometer with thermal peltier control.',
    bufferMin: 30, // FR-15: Extra buffer for slow machine
    status: 'operational',
    warning: 'Slow thermal stabilization: Extra 30m clean & balance buffer is reserved after your run.',
    icon: 'Activity'
  }
];

export const STATUS_CONFIG = {
  scheduled: {
    label: 'Scheduled',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  waiting: {
    label: 'Waiting Queue',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500'
  },
  unplaced: {
    label: 'Could Not Place',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500'
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400'
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClass: 'bg-indigo-500'
  },
  moved: {
    label: 'Schedule Moved',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500'
  },
  risk: {
    label: 'Deadline Risk',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500'
  }
};
