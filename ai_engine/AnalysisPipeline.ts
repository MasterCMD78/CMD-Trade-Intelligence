import { Candle, MarketStructureResult } from "./analysis/types";
import { MarketStructureEngine } from "./analysis/market_structure/MarketStructureEngine";
import { SmartMoneyEngine, SmartMoneyAnalysis } from "./analysis/smart_money/SmartMoneyEngine";
import { IndicatorEngine, IndicatorResult } from "./analysis/indicators/IndicatorsEngine";
import { ConfidenceEngine, ConfidenceResult } from "./confidence/ConfidenceEngine";
import { DecisionEngine, DecisionResult } from "./decision_engine/DecisionEngine";
import { RiskEngine, RiskInput, RiskResult } from "./risk/RiskEngine";
import { ReportGenerator, AIReport } from "./report/ReportGenerator";

export interface PipelineResult {
  marketStructure: MarketStructureResult;
  smartMoney: SmartMoneyAnalysis;
  indicators: IndicatorResult;
  confidence: ConfidenceResult;
  decision: DecisionResult;
  risk: RiskResult;
  report: AIReport;
}

export class AnalysisPipeline {

  static run(candles: Candle[], riskInput: RiskInput): PipelineResult {

    const marketStructure =
      MarketStructureEngine.analyze(candles);

    const smartMoney =
      SmartMoneyEngine.analyze(candles);

    const indicators =
      IndicatorEngine.analyze(candles);

    const confidence =
      ConfidenceEngine.calculate(smartMoney, indicators);

    const decision =
      DecisionEngine.decide(confidence);

    const risk =
      RiskEngine.calculate(riskInput);

    const report =
      ReportGenerator.generate(decision, confidence);

    return {
      marketStructure,
      smartMoney,
      indicators,
      confidence,
      decision,
      risk,
      report,
    };

  }

}
