import { DecisionResult } from "../decision_engine/DecisionEngine";
import { ConfidenceResult } from "../confidence/ConfidenceEngine";

export interface AIReport {

  decision: string;

  confidence: number;

  reasons: string[];

  summary: string;

}

export class ReportGenerator {

  static generate(
    decision: DecisionResult,
    confidence: ConfidenceResult
  ): AIReport {

    let summary = "";

    if (decision.decision === "BUY") {

      summary =
        "The market shows bullish conditions with multiple confirmations.";

    } else if (decision.decision === "SELL") {

      summary =
        "The market shows bearish conditions with multiple confirmations.";

    } else {

      summary =
        "The market conditions are unclear. Waiting is recommended.";

    }

    return {

      decision: decision.decision,

      confidence: confidence.score,

      reasons: confidence.reasons,

      summary,

    };

  }

}