import { BigDecimal } from '@graphprotocol/graph-ts'
import { Transfer } from '../generated/DAI/Token'
import { Asset, Trust } from '../generated/schema'
import { DeFiCategory } from './constants'
import { createAsset } from './assets'

import {
  createTrust,
  exponentToBigDecimal,
  updateCommonTokenStats
} from './utils'

export function handleTransfer(event: Transfer): void {
  let assetID = event.address.toHexString()
  let asset = Asset.load(assetID)
  if (asset == null) {
    asset = createAsset(assetID)
    asset.save()
  }
  let TokenDecimals = asset.decimals
  let TokenDecimalsBD: BigDecimal = exponentToBigDecimal(TokenDecimals)
  let trustFromID = event.params.from.toHex()
  if (trustFromID != assetID) {
    let trustFrom = Trust.load(trustFromID)
    if (trustFrom == null) {
      createTrust(trustFromID)
    }
    let TokenStatsFrom = updateCommonTokenStats(
      asset.id,
      asset.symbol,
      trustFromID
    )
    TokenStatsFrom.balance = TokenStatsFrom.balance.minus(
      event.params.value
        .toBigDecimal()
        .div(TokenDecimalsBD)
        .truncate(TokenDecimals),
    )
    TokenStatsFrom.category = DeFiCategory.get(assetID) as string
    TokenStatsFrom.trustID = trustFromID
    TokenStatsFrom.save()
  }
  let trustToID = event.params.to.toHex()
  if (trustToID != assetID) {
    let trustTo = Trust.load(trustToID)
    if (trustTo == null) {
      createTrust(trustToID)
    }
    let TokenStatsTo = updateCommonTokenStats(
      asset.id,
      asset.symbol,
      trustToID
    )
    TokenStatsTo.balance = TokenStatsTo.balance.plus(
      event.params.value
        .toBigDecimal()
        .div(TokenDecimalsBD)
        .truncate(TokenDecimals),
    )
    TokenStatsTo.category = DeFiCategory.get(assetID) as string
    TokenStatsTo.trustID = trustToID
    TokenStatsTo.save()
  }
}