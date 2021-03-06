// there are ~31556952000 milliseconds per gregorian year, so each millisecond
// since the last log timestamp accounts for an expected growth rate of 1/31556952000 of the APY
const MS_PER_YEAR = 31556952000;
const config = require("../config");
const { add, divide, multiply, pow, subtract } = require("mathjs");
const memory = require("../data/memory");
module.exports = async (ticker) => {
  const action = {};
  action.dateNow = ticker.dateOverride || new Date();
  action.dateLast = memory.lastLog.Time
    ? new Date(memory.lastLog.Time)
    : action.dateNow;
  action.msPassed = action.dateNow - action.dateLast; // milliseconds delta
  action.exchangeRate = ticker.price;
  action.currentHolding = add(memory.lastLog.Holding, memory.lastLog.Shares);
  // we get the period rate for the APY by taking the APY (e.g. 10% as 1.10) and raising it to the power
  // of the delta in time, then subtract 1 to get the change multiplier
  action.periodRate =
    pow(1 + config.apy, divide(1, divide(MS_PER_YEAR, action.msPassed))) - 1;
  action.expectedGain = multiply(memory.lastLog.Target, action.periodRate);
  // liquid value of our holdings in the target ticker
  action.value = multiply(action.currentHolding, action.exchangeRate);
  // we want our position to grow by the expected gain + our vol target + the last target (accumulates APY expectation)
  action.target = add(config.vol, action.expectedGain, memory.lastLog.Target);
  action.diff = subtract(action.value, action.target);
  // simply, if our account value is above the target, sell, else buy
  // the `funds` is our market buy/sell amount in the base currency
  const tradeValue = process.env.CPBB_LIQUIDATE ? action.value : config.vol;
  action.funds = action.diff > 0 ? tradeValue * -1 : config.vol;
  action.endValue = add(action.value, action.funds);
  action.realized = add(
    memory.lastLog.Realized,
    action.funds > 0 ? 0 : action.funds * -1
  );
  // total input does not subtract when we take profit (that's realized profit)
  action.totalInput = add(
    memory.lastLog.TotalInput,
    action.funds > 0 ? action.funds : 0
  );
  action.totalValue = add(action.endValue, action.realized);
  action.liquidValue = subtract(action.totalValue, action.totalInput);
  return action;
};
