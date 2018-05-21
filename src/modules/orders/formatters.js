import config from 'common/config'
import * as datas from 'common/config/data'
import * as fm from 'LoopringJS/common/formatter'
import {getBalanceBySymbol, getPriceBySymbol} from '../tokens/TokenFm'
import {isApproving} from '../transactions/formatters'
import contracts from 'LoopringJS/ethereum/contracts/Contracts'

const integerReg = new RegExp("^[0-9]*$")
const amountReg = new RegExp("^(([0-9]+\\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\\.[0-9]+)|([0-9]*[1-9][0-9]*))$")

export function tokenDisplayBalance(tokenSymbol, rawBalance) {
  const tokenConfig = config.getTokenBySymbol(tokenSymbol)
  if(!tokenConfig) {
    throw new Error('Not support token:'+tokenSymbol)
  }
  return fm.toFixed(fm.toBig(rawBalance).div('1e'+tokenConfig.digits), tokenConfig.precision, false)
}

export function calculateAvailableAmount(side, price, tokenL, tokenR, amountPrecision) {
  if(price && tokenL && tokenR) {
    if(side === 'buy') {
      if(price) {
        return fm.toFixed(fm.toBig(tokenR.balance).div(price), amountPrecision, false)
      }
    } else {
      return fm.toFixed(fm.toBig(tokenL.balance), amountPrecision, false)
    }
  }
  return 0
}

export function sliderEffectAmount(availableAmount, percentage, tokenL, tokenR) {
  if(fm.toBig(availableAmount).gt(0)) {
    const marketConfig = config.getMarketBySymbol(tokenL.symbol, tokenR.symbol)
    const amountPrecision = Math.max(0, tokenR.precision - marketConfig.pricePrecision)
    return fm.toFixed(fm.toBig(availableAmount).times(percentage).div(100), amountPrecision, false)
  }
  return 0
}

export function amountEffectSlider(availableAmount, amountInput) {
  if(fm.toBig(availableAmount).gt(0) && fm.toBig(amountInput).gt(0)) {
    if(fm.toBig(amountInput).gt(availableAmount)) {
      return 100
    }
    return fm.toNumber(fm.toFixed(fm.toBig(amountInput).div(availableAmount).times(100), 0, true))
  }
  return 0
}

export function sliderChangeEffectAmount(state) {
  return sliderEffectAmount(state[state.side].availableAmount, state.amountSlider, state.left, state.right)
}

export function amountChangeEffectSlider(availableAmount, amountInput) {
  return amountEffectSlider(availableAmount, amountInput)
}

export function isValidAmount(amount) {
  return amountReg.test(amount)
}

export function isValidInteger(int) {
  return integerReg.test(int)
}

export function formatPriceByMarket(price, marketConfig) {
  const priceArr = price.split(".")
  if(priceArr.length === 2 && priceArr[1].length > marketConfig.pricePrecision){
    return fm.toNumber(fm.toFixed(fm.toNumber(price), marketConfig.pricePrecision), false)
  }
  return price
}

export function formatAmountByMarket(amount, tokenConfig, marketConfig) {
  const amountPrecision = tokenConfig.precision - marketConfig.pricePrecision
  if (amountPrecision > 0) {
    return fm.toNumber(fm.toFixed(amount, amountPrecision, false))
  } else {
    return Math.floor(amount)
  }
}

export function calculateWorthInLegalCurrency(marketcapItems, symbol, amount) {
  const price = getPriceBySymbol({prices:marketcapItems, symbol})
  return amount.times(price.price)
}

export function calculateLrcFeeInEth(marketcapItems, totalWorth, milliLrcFee) {
  const price = getPriceBySymbol({prices:marketcapItems, symbol:"ETH"})
  return totalWorth.times(milliLrcFee).div(1000).div(fm.toBig(price.price))
}

export function calculateLrcFeeByEth(marketcapItems, ethAmount) {
  const ethPrice = getPriceBySymbol({prices:marketcapItems, symbol:"ETH"})
  const lrcPrice = getPriceBySymbol({prices:marketcapItems, symbol:"LRC"})
  const price = fm.toBig(lrcPrice.price).div(fm.toBig(ethPrice.price))
  return fm.toFixed(fm.toBig(ethAmount).div(price), 2, true)
}

export function calculateLrcFee(marketcapItems, total, milliLrcFee, tokenR) {
  const totalWorth = calculateWorthInLegalCurrency(marketcapItems, tokenR, fm.toBig(total))
  if(totalWorth.lt(0)) {
    return 0
  }
  const percentage = datas.configs.defaultLrcFeePermillage;
  const minimumLrcfeeInEth = datas.configs.minimumLrcfeeInEth;
  if (!milliLrcFee) {
    milliLrcFee = Number(percentage)
  }
  let userSetLrcFeeInEth = calculateLrcFeeInEth(marketcapItems, totalWorth, milliLrcFee)
  if(userSetLrcFeeInEth.gt(minimumLrcfeeInEth)){
    return calculateLrcFeeByEth(marketcapItems, userSetLrcFeeInEth)
  } else {
    return calculateLrcFeeByEth(marketcapItems, minimumLrcfeeInEth)
  }
}

export function validateOptionInteger(value) {
  if (value) {
    return integerReg.test(value)
  } else {
    return true
  }
}

function cutDecimal(bn, precision) {
  const str = bn.toString(10)
  const numberArr = str.split('.')
  if(precision > 0) {
    if(numberArr.length === 2) {
      if(numberArr[1].length >= precision) {
        return numberArr[0] + '.' + numberArr[1].substring(0, precision)
      } else {
        return numberArr[0] + '.' + numberArr[1] + '0'.repeat(precision - numberArr[1].length)
      }
    } else {
      return str + '.' + '0'.repeat(precision)
    }
  } else {
    bn.floor().toString(10)
  }
}

function ceilDecimal(bn, precision) {
  const floor = cutDecimal(bn, precision)
  if(precision > 0) {
    const v = '0.'+ '0'.repeat(precision -1) + '1'
    return cutDecimal(fm.toBig(floor).add(v), precision)
  } else {
    return bn.add(1).ceil().toString(10)
  }
}

export async function tradeVerification(balances, walletState, tradeInfo, sell, buy, tokenL, tokenR, side, txs) {
  const configSell = config.getTokenBySymbol(sell.symbol)
  const ethBalance = getBalanceBySymbol({balances, symbol:'ETH', toUnit:true})
  const lrcBalance = getBalanceBySymbol({balances, symbol:'LRC', toUnit:true})
  const approveGasLimit = config.getGasLimitByType('approve').gasLimit
  let frozenSell = await window.RELAY.account.getEstimatedAllocatedAllowance({owner:walletState.address, token:sell.symbol})
  let frozenAmountS = fm.toBig(frozenSell.result).div('1e'+configSell.digits).add(fm.toBig(tradeInfo.total))
  let approveCount = 0
  const warn = new Array(), error = new Array()
  if(buy.symbol === 'LRC') { //buy lrc, only verify eth balance could cover gas cost if approve is needed
    if(fm.toBig(sell.balance).lessThan(frozenAmountS)) {
      warn.push({type:"BalanceNotEnough", value:{symbol:sell.symbol, balance:cutDecimal(sell.balance,6), required:ceilDecimal(frozenAmountS.sub(sell.balance).toNumber(),6)}})
    }
    const txAllowance = isApproving(txs, sell.symbol);
    const pendingAllowance = fm.toBig(txAllowance ? txAllowance.div('1e'+sell.digits):sell.allowance);
    if(frozenAmountS.greaterThan(pendingAllowance)) {
      warn.push({type:"AllowanceNotEnough", value:{symbol:sell.symbol, allowance:cutDecimal(pendingAllowance.toNumber(),6), required:ceilDecimal(frozenAmountS.sub(sell.allowance).toNumber(),6)}})
      approveCount += 1
      if(pendingAllowance.greaterThan(0)) {approveCount += 1}
    }
    //TODO gas price
    const gas = fm.toBig('21').times(fm.toNumber(approveGasLimit)).div(1e9).times(approveCount)
    if(ethBalance.balance.lessThan(gas)){
      error.push({type:"BalanceNotEnough", value:{symbol:'ETH', balance:cutDecimal(ethBalance.balance,6), required:ceilDecimal(gas,6)}})
      tradeInfo.error = error
      return
    }
  } else {
    //lrc balance not enough, lrcNeed = frozenLrc + lrcFee
    const frozenLrcFee = await window.RELAY.account.getFrozenLrcFee(walletState.address)
    let frozenLrc = fm.toBig(frozenLrcFee.result).div(1e18).add(fm.toBig(tradeInfo.lrcFee))
    let failed = false
    if(lrcBalance.balance.lessThan(frozenLrc)){
      error.push({type:"BalanceNotEnough", value:{symbol:'LRC', balance:cutDecimal(lrcBalance.balance,6), required:ceilDecimal(frozenLrc,6)}})
      failed = true
    }
    const frozenLrcInOrderResult = await window.RELAY.account.getEstimatedAllocatedAllowance({owner:walletState.address, token:'LRC'})
    frozenLrc = frozenLrc.add(fm.toBig(frozenLrcInOrderResult.result).div(1e18))
    if(tokenL === 'LRC' && side === 'sell') {// sell lrc-weth
      frozenLrc = frozenLrc.add(fm.toBig(tradeInfo.amount))
    }
    if(tokenR === 'LRC' && side === 'buy'){// buy eos-lrc
      frozenLrc = frozenLrc.add(fm.toBig(tradeInfo.total))
    }
    // verify tokenL/tokenR balance and allowance cause gas cost
    if(sell.symbol === 'LRC') {
      frozenAmountS = frozenLrc
    }
    if(sell.balance.lessThan(frozenAmountS)) {
      warn.push({type:"BalanceNotEnough", value:{symbol:sell.symbol, balance:cutDecimal(sell.balance,6), required:ceilDecimal(frozenAmountS.sub(sell.balance).toNumber(),6)}})
    }
    const pendingAllowance = fm.toBig(isApproving(txs, sell.symbol) ? isApproving(txs, sell.symbol).div('1e'+sell.digits) : sell.allowance);
    if(pendingAllowance.lessThan(frozenAmountS)) {
      warn.push({type:"AllowanceNotEnough", value:{symbol:sell.symbol, allowance:cutDecimal(pendingAllowance,6), required:ceilDecimal(frozenAmountS.sub(sell.allowance),6)}})
      approveCount += 1
      if(pendingAllowance.greaterThan(0)) approveCount += 1
    }
    // lrcFee allowance
    const pendingLRCAllowance = fm.toBig(isApproving(txs, 'LRC') ? isApproving(txs, 'LRC').div(1e18):lrcBalance.allowance);
    if(frozenLrc.greaterThan(pendingLRCAllowance) && sell.symbol !== 'LRC') {
      warn.push({type:"AllowanceNotEnough", value:{symbol:"LRC", allowance:cutDecimal(pendingLRCAllowance,6), required:ceilDecimal(frozenLrc.sub(lrcBalance.allowance),6)}})
      approveCount += 1
      if(pendingLRCAllowance.greaterThan(0)) approveCount += 1
    }
    //TODO gas price
    const gas = fm.toBig('21').times(approveGasLimit).div(1e9).times(approveCount)
    if(ethBalance.balance.lessThan(gas)){
      error.push({type:"BalanceNotEnough", value:{symbol:'ETH', balance:cutDecimal(ethBalance.balance,6), required:ceilDecimal(gas,6)}})
      failed = true
    }
    if(failed) {
      tradeInfo.error = error
      return
    }
  }
  tradeInfo.warn = warn
}

export function generateApproveTx({symbol, amount, gasPrice, gasLimit, nonce}) {
  const tx = {};
  const tokenConfig = config.getTokenBySymbol(symbol)
  tx.to = tokenConfig.address;
  tx.value = "0x0";
  tx.data = contracts.ERC20Token.encodeInputs('approve', {_spender:datas.configs.delegateAddress, _value:amount});
  tx.gasPrice = gasPrice
  tx.gasLimit = gasLimit
  tx.nonce = nonce
  tx.chainId = datas.configs.chainId
  return tx
}
