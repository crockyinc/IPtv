import { create } from 'zustand';
import type { CategoryFilter } from '@/types/iptv';
import {
  STORAGE_KEYS,
  readBoolean,
  readJsonArray,
  readNumber,
  readString,
  writeBoolean,
  writeJsonArray,
  writeNumber,
  writeString,
} from '@/lib/storage';

const MAX_RECENT = 24;
const NOTICE_TIMEOUT = 2600;

export interface Notice {
  id: number;
  message: string;
  tone: 'default' | 'error';
}

interface AppState {
  /* preferences ---------------------------------------------------------- */
  countryCode: string | null;
  sidebarCollapsed: boolean;
  recentChannelIds: string[];
  volume: number;
  muted: boolean;

  /* ephemeral UI --------------------------------------------------------- */
  mobileSidebarOpen: boolean;
  countryPickerOpen: boolean;
  searchQuery: string;
  categoryFilter: CategoryFilter;
  notice: Notice | null;

  /* actions -------------------------------------------------------------- */
  setCountry: (code: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  openCountryPicker: () => void;
  closeCountryPicker: () => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (filter: CategoryFilter) => void;
  addRecentChannel: (id: string) => void;
  clearRecentChannels: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  pushNotice: (message: string, tone?: Notice['tone']) => void;
  dismissNotice: () => void;
}

function readInitialCountry(): string | null {
  const stored = readString(STORAGE_KEYS.country, '');
  return /^[A-Za-z]{2}$/.test(stored) ? stored.toUpperCase() : null;
}

function readInitialSidebar(): boolean {
  if (typeof document !== 'undefined') {
    const fromDataset = document.documentElement.dataset.sidebar;
    if (fromDataset === 'collapsed') return true;
    if (fromDataset === 'expanded') return false;
  }
  return readBoolean(STORAGE_KEYS.sidebar, false);
}

let noticeSeq = 0;

export const useAppStore = create<AppState>((set, get) => ({
  countryCode: readInitialCountry(),
  sidebarCollapsed: readInitialSidebar(),
  recentChannelIds: readJsonArray(STORAGE_KEYS.recent),
  volume: Math.min(1, Math.max(0, readNumber(STORAGE_KEYS.volume, 0.8))),
  muted: readBoolean(STORAGE_KEYS.muted, true),

  mobileSidebarOpen: false,
  countryPickerOpen: false,
  searchQuery: '',
  categoryFilter: 'all',
  notice: null,

  setCountry: (code) => {
    const normalized = code.toUpperCase();
    writeString(STORAGE_KEYS.country, normalized);
    set({
      countryCode: normalized,
      countryPickerOpen: false,
      categoryFilter: 'all',
      searchQuery: '',
      mobileSidebarOpen: false,
    });
  },

  toggleSidebar: () => {
    const collapsed = !get().sidebarCollapsed;
    writeBoolean(STORAGE_KEYS.sidebar, collapsed);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    }
    set({ sidebarCollapsed: collapsed });
  },

  setSidebarCollapsed: (collapsed) => {
    writeBoolean(STORAGE_KEYS.sidebar, collapsed);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    }
    set({ sidebarCollapsed: collapsed });
  },

  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  openCountryPicker: () => set({ countryPickerOpen: true, mobileSidebarOpen: false }),
  closeCountryPicker: () => {
    // The picker is mandatory until a country has been chosen.
    if (get().countryCode) set({ countryPickerOpen: false });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategoryFilter: (filter) => set({ categoryFilter: filter, mobileSidebarOpen: false }),

  addRecentChannel: (id) => {
    const next = [id, ...get().recentChannelIds.filter((existing) => existing !== id)].slice(
      0,
      MAX_RECENT,
    );
    writeJsonArray(STORAGE_KEYS.recent, next);
    set({ recentChannelIds: next });
  },

  clearRecentChannels: () => {
    writeJsonArray(STORAGE_KEYS.recent, []);
    set({ recentChannelIds: [] });
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume));
    writeNumber(STORAGE_KEYS.volume, clamped);
    set({ volume: clamped, muted: clamped === 0 ? get().muted : false });
    if (clamped > 0) writeBoolean(STORAGE_KEYS.muted, false);
  },

  setMuted: (muted) => {
    writeBoolean(STORAGE_KEYS.muted, muted);
    set({ muted });
  },

  pushNotice: (message, tone = 'default') => {
    noticeSeq += 1;
    const id = noticeSeq;
    set({ notice: { id, message, tone } });
    setTimeout(() => {
      if (get().notice?.id === id) set({ notice: null });
    }, NOTICE_TIMEOUT);
  },

  dismissNotice: () => set({ notice: null }),
}));
