/**
 * News provider interface (Phase 5, Part 9).
 *
 * Mirrors `market-data/provider.interface.ts`'s shape: a swappable interface
 * so a real economic-calendar API can replace `MockNewsProvider` later
 * without touching the pure engine or any call site.
 */

import type { EconomicEvent } from "./types.js";

export interface NewsQueryParams {
  /** Only events for these currencies; omit for all supported currencies. */
  currencies?: string[];
  /** Inclusive lower bound on `scheduledTime`. */
  from: Date;
  /** Inclusive upper bound on `scheduledTime`. */
  to: Date;
}

export interface INewsProvider {
  /** Returns events (in any order) whose `scheduledTime` falls within `params.from`/`params.to`. */
  getEvents(params: NewsQueryParams): Promise<EconomicEvent[]>;
}
