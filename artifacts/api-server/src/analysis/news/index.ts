/**
 * Barrel export for the Economic News & Fundamental Intelligence Engine (Phase 5).
 */

export * from "./types.js";
export * from "./config.js";
export * from "./currency-mapping.js";
export * from "./event-value.js";
export * from "./bias.js";
export * from "./confidence.js";
export * from "./restrictions.js";
export * from "./engine.js";
export * from "./provider.interface.js";
export { MockNewsProvider } from "./mock.provider.js";
export { newsService, NewsService } from "./news.service.js";
