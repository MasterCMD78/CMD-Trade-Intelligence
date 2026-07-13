/**
 * NewsService (Phase 5, Part 9).
 *
 * Provider-agnostic entry point for news data, mirroring
 * `market-data/market-data.service.ts`. Fetches raw events from the active
 * `INewsProvider` and hands them to the pure `computeNewsAnalysis` engine.
 * Swap providers later via `setProvider` without touching any call site.
 */

import { computeNewsAnalysis } from "./engine.js";
import { DEFAULT_NEWS_CONFIG, type NewsEngineConfig } from "./config.js";
import { getRelevantCurrencies } from "./currency-mapping.js";
import { MockNewsProvider } from "./mock.provider.js";
import type { INewsProvider } from "./provider.interface.js";
import type { EconomicEvent, NewsAnalysisResult } from "./types.js";

class NewsService {
  private provider: INewsProvider;

  constructor(provider: INewsProvider) {
    this.provider = provider;
  }

  setProvider(newProvider: INewsProvider): void {
    this.provider = newProvider;
  }

  get providerName(): string {
    return this.provider.constructor.name;
  }

  /** Raw events relevant to `symbol`'s currencies, from `biasLookbackHours` in the past through `lookaheadHours` ahead of `now`. */
  async getRelevantEvents(
    symbol: string,
    now: Date = new Date(),
    config: NewsEngineConfig = DEFAULT_NEWS_CONFIG,
  ): Promise<EconomicEvent[]> {
    const currencies = getRelevantCurrencies(symbol).map((r) => r.currency);
    if (currencies.length === 0) return [];

    const from = new Date(now.getTime() - config.biasLookbackHours * 3_600_000);
    const to = new Date(now.getTime() + config.lookaheadHours * 3_600_000);
    return this.provider.getEvents({ currencies, from, to });
  }

  /** Fetches relevant events and computes the full news analysis for `symbol` at `now`. */
  async analyze(symbol: string, now: Date = new Date(), config: NewsEngineConfig = DEFAULT_NEWS_CONFIG): Promise<NewsAnalysisResult> {
    const events = await this.getRelevantEvents(symbol, now, config);
    return computeNewsAnalysis({ symbol, now, events, config });
  }
}

export const newsService = new NewsService(new MockNewsProvider());
export { NewsService };
