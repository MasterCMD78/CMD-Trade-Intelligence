import { ConfidenceResult } from "../confidence/ConfidenceEngine";

export type TradeDecision = "BUY" | "SELL" | "HOLD";

export interface DecisionResult {

  decision: TradeDecision;

  confidence: number;

  reasons: string[];

}

export class DecisionEngine {

  static decide(
    confidence: ConfidenceResult
  ): DecisionResult {

    let decision: TradeDecision = "HOLD";

    if (
      confidence.confidence === "HIGH" &&
      confidence.score >= 60
    ) {

      decision = "BUY";

    }

    if (
      confidence.confidence === "LOW"
    ) {

      decision = "HOLD";

    }

    return {

      decision,

      confidence: confidence.score,

      reasons: confidence.reasons,

    };

  }

}