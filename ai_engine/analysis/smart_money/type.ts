export interface OrderBlock {
  type: "BULLISH" | "BEARISH";

  high: number;

  low: number;

  index: number;

  strength: number;

  mitigated: boolean;
}