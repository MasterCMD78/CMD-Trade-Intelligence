import { Candle } from "./analysis/types";
import { MarketStructureEngine } from "./analysis/market_structure/MarketStructureEngine";
import { SmartMoneyEngine } from "./analysis/smart_money/SmartMoneyEngine";
import { IndicatorEngine } from "./analysis/indicators/IndicatorsEngine";
import { ConfidenceEngine } from "./confidence/ConfidenceEngine";
import { DecisionEngine } from "./decision_engine/DecisionEngine";
import { ReportGenerator } from "./report/ReportGenerator";

export class AIEngine {

  static analyze(candles: Candle[]) {

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

    const report =
      ReportGenerator.generate(
        decision,
        confidence
      );

    return {

      marketStructure,

      smartMoney,

      indicators,

      confidence,

      decision,

      report,

    };

  }

}
