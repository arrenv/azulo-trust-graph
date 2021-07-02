/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { AzuloTrustDaily, AzuloTrustFactory } from '../generated/schema'
import { FACTORY_ADDRESS, ONE_BI, ZERO_BD, ZERO_BI } from './utils'

export function updateAzuloTrustDaily(event): AzuloTrustDaily {
  let azulo = AzuloTrustFactory.load(FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let azuloDayData = AzuloTrustDaily.load(dayID.toString())
  if (azuloDayData === null) {
    azuloDayData = new AzuloTrustDaily(dayID.toString())
    azuloDayData.date = dayStartTimestamp
    azuloDayData.dailyVolumeUSD = ZERO_BD
    azuloDayData.dailyVolumeETH = ZERO_BD
    azuloDayData.totalVolumeUSD = ZERO_BD
    azuloDayData.totalVolumeETH = ZERO_BD
    azuloDayData.dailyVolumeUntracked = ZERO_BD
  }

  azuloDayData.txCount = azulo.txCount
  azuloDayData.save()

  return azuloDayData as AzuloTrustDaily
}