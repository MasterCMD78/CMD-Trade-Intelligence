/**
 * Market Data module barrel.
 * Import everything market-data related from this single entry point.
 */

export * from "./types.js";
export * from "./provider.interface.js";
export { MockMarketDataProvider } from "./mock.provider.js";
export { marketDataService } from "./market-data.service.js";
export type { TimeframeInfo } from "./market-data.service.js";
export { wsManager, WsChannels } from "./websocket.manager.js";
export type { WsMessage, WsMessageType } from "./websocket.manager.js";
