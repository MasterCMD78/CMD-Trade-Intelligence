export interface RiskInput {

  accountBalance: number;

  riskPercent: number;

  entryPrice: number;

  stopLoss: number;

  takeProfit: number;

}

export interface RiskResult {

  riskAmount: number;

  rewardAmount: number;

  riskRewardRatio: number;

}

export class RiskEngine {

  static calculate(input: RiskInput): RiskResult {

    const riskAmount =
      input.accountBalance * (input.riskPercent / 100);

    const riskDistance =
      Math.abs(input.entryPrice - input.stopLoss);

    const rewardDistance =
      Math.abs(input.takeProfit - input.entryPrice);

    const riskRewardRatio =
      rewardDistance / riskDistance;

    const rewardAmount =
      riskAmount * riskRewardRatio;

    return {

      riskAmount,

      rewardAmount,

      riskRewardRatio,

    };

  }

}