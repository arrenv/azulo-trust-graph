/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { AzuloTrustDaily, AzuloTrustFactory } from '../generated/schema'
import { TRUST_FACTORY_ADDRESS, ONE_BI, ZERO_BD, ZERO_BI } from './utils'
import { Transfer } from '../generated/DAI/Token'
import { ProxyCreation } from '../generated/GnosisSafeProxyFactory/GnosisSafeProxyFactory'
import { AddedOwner } from '../generated/templates/GnosisSafe/GnosisSafe'

export function updateAzuloTrustDaily(event: ProxyCreation): AzuloTrustDaily {
  let azulo = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let azuloDayData = AzuloTrustDaily.load(dayID.toString())
  if (azuloDayData === null) {
    azuloDayData = new AzuloTrustDaily(dayID.toString())
    azuloDayData.date = dayStartTimestamp
    azuloDayData.newTrusts = 0
    azuloDayData.newBeneficiaries = 0
    azuloDayData.dailyVolumeUSD = ZERO_BD
    azuloDayData.dailyVolumeETH = ZERO_BD
    azuloDayData.totalVolumeUSD = ZERO_BD
    azuloDayData.totalVolumeETH = ZERO_BD
    azuloDayData.dailyVolumeUntracked = ZERO_BD
  }

  azuloDayData.totalTrusts = azulo.totalTrusts
  azuloDayData.totalBeneficiaries = azulo.totalBeneficiaries
  azuloDayData.newTrusts = azuloDayData.newTrusts + 1
  azuloDayData.txCount = azulo.txCount
  azuloDayData.save()

  return azuloDayData as AzuloTrustDaily
}

export function addAzuloBeneficiaryDaily(event: AddedOwner): AzuloTrustDaily {
  let azulo = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let azuloDayData = AzuloTrustDaily.load(dayID.toString())
  if (azuloDayData === null) {
    azuloDayData = new AzuloTrustDaily(dayID.toString())
    azuloDayData.date = dayStartTimestamp
    azuloDayData.totalTrusts = azulo.totalTrusts
    azuloDayData.totalBeneficiaries = azulo.totalBeneficiaries
    azuloDayData.newTrusts = 0
    azuloDayData.dailyVolumeUSD = ZERO_BD
    azuloDayData.dailyVolumeETH = ZERO_BD
    azuloDayData.totalVolumeUSD = ZERO_BD
    azuloDayData.totalVolumeETH = ZERO_BD
    azuloDayData.dailyVolumeUntracked = ZERO_BD
  }

  azuloDayData.newBeneficiaries = azuloDayData.newBeneficiaries + 1
  azuloDayData.txCount = azulo.txCount
  azuloDayData.save()

  return azuloDayData as AzuloTrustDaily
}

export function updateAzuloTrustDailyValue(event: Transfer, tokenDerivedETH: BigDecimal, tokenDerivedUSD: BigDecimal): AzuloTrustDaily {
  let azulo = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let azuloDayData = AzuloTrustDaily.load(dayID.toString())
  if (azuloDayData === null) {
    azuloDayData = new AzuloTrustDaily(dayID.toString())
    azuloDayData.date = dayStartTimestamp
    azuloDayData.totalTrusts = azulo.totalTrusts
    azuloDayData.totalBeneficiaries = azulo.totalBeneficiaries
    azuloDayData.newTrusts = 0
    azuloDayData.newBeneficiaries = 0
    azuloDayData.dailyVolumeUSD = ZERO_BD
    azuloDayData.dailyVolumeETH = ZERO_BD
    azuloDayData.totalVolumeUSD = ZERO_BD
    azuloDayData.totalVolumeETH = ZERO_BD
    azuloDayData.dailyVolumeUntracked = ZERO_BD
  }

  azuloDayData.dailyVolumeUSD = azuloDayData.dailyVolumeUSD.plus(tokenDerivedUSD)
  azuloDayData.dailyVolumeETH = azuloDayData.dailyVolumeETH.plus(tokenDerivedETH)
  azuloDayData.totalVolumeUSD = azuloDayData.totalVolumeUSD.plus(azulo.totalVolumeUSD)
  azuloDayData.totalVolumeETH = azuloDayData.totalVolumeETH.plus(azulo.totalVolumeETH)
  azuloDayData.txCount = azulo.txCount
  azuloDayData.save()

  return azuloDayData as AzuloTrustDaily
}