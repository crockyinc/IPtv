import { useEffect, useMemo } from 'react';
import type { Catalog, CategoryOption, Channel, CountryOption } from '@/types/iptv';
import { useCatalogStore } from '@/store/useCatalogStore';
import { getCategoriesForCountry } from '@/services/iptvApi';

/** Loads the catalog once per session and exposes its status. */
export function useCatalog(): {
  catalog: Catalog | null;
  status: ReturnType<typeof useCatalogStore.getState>['status'];
  error: string | null;
  retry: () => void;
} {
  const { catalog, status, error, ensureLoaded } = useCatalogStore();

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  return {
    catalog,
    status,
    error,
    retry: () => void ensureLoaded(true),
  };
}

export function useCountries(catalog: Catalog | null): CountryOption[] {
  return catalog?.countries ?? [];
}

export function useCategoriesForCountry(
  catalog: Catalog | null,
  countryCode: string | null,
): CategoryOption[] {
  return useMemo(() => (catalog ? getCategoriesForCountry(catalog, countryCode) : []), [
    catalog,
    countryCode,
  ]);
}

export function useCountryChannels(catalog: Catalog | null, countryCode: string | null): Channel[] {
  return useMemo(() => {
    if (!catalog || !countryCode) return [];
    return catalog.channelsByCountry.get(countryCode) ?? [];
  }, [catalog, countryCode]);
}

/** Case-insensitive multi-token match against the pre-computed search key. */
export function filterChannels(channels: Channel[], query: string): Channel[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return channels;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const token = tokens[0]!;
    return channels.filter((channel) => channel.searchKey.includes(token));
  }

  return channels.filter((channel) => tokens.every((token) => channel.searchKey.includes(token)));
}

export function filterByCategory(channels: Channel[], categoryId: string | null): Channel[] {
  if (!categoryId || categoryId === 'all') return channels;
  return channels.filter((channel) => channel.categoryIds.includes(categoryId));
}
