import { Candle } from "./type";

import { MarketStructureEngine } from "./market_structure/MarketStructureEngine";
import { SmartMoneyEngine } from "./smart_money/SmartMoneyEngine";
import { ConfidenceEngine } from "./confidence/ConfidenceEngine";
import { DecisionEngine } from "./decision/DecisionEngine";
import { ReportGenerator } from "./report/ReportGenerator";

export class AIEngine {

  static analyze(candles: Candle[]) {

    const marketStructure =
      MarketStructureEngine.analyze(candles);

    const smartMoney =
      SmartMoneyEngine.analyze(candles);

    const confidence =
      ConfidenceEngine.calculate(smartMoney);

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

      confidence,

      decision,

      report,

    };

  }

}