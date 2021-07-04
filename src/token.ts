import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { Transfer } from '../generated/DAI/Token'
import { Asset, Trust } from '../generated/schema'
import { DeFiCategory } from './constants'
import { createAsset } from './assets'
import { addTrustTokenAssets, subtractTrustTokenAssets } from './trust'
import { exponentToBigDecimal, updateCommonTokenStats } from './utils'

export function handleTransfer(event: Transfer): void {
    // Check if token asset exists if not create
    let assetID = event.address.toHexString()
    let asset = Asset.load(assetID)
    if (asset == null) {
        asset = createAsset(assetID)
        asset.save()
    }
    let TokenDecimals = asset.decimals
    // let TokenDecimalsBD: BigDecimal = exponentToBigDecimal(TokenDecimals as BigInt)
    let TokenDecimalsBD: BigDecimal = new BigDecimal(TokenDecimals as BigInt)

    // Load trust
    let AddrFrom = event.params.from.toHex()
    let AddrTo = event.params.to.toHex()
    let trustFrom = Trust.load(AddrFrom)
    let trustTo = Trust.load(AddrTo)

    // Check if trust is the transaction sender
    if(trustFrom != null) {
        let TokenStatsFrom = updateCommonTokenStats(
            asset.id,
            asset.symbol,
            AddrFrom
        )
        TokenStatsFrom.balance = TokenStatsFrom.balance.minus(
            event.params.value
                .toBigDecimal()
                .div(TokenDecimalsBD)
                .truncate(TokenDecimals as i32),
        )
        TokenStatsFrom.category = DeFiCategory.get(assetID) as string
        TokenStatsFrom.trustID = AddrFrom
        TokenStatsFrom.save()

        subtractTrustTokenAssets(event, event.params.from, TokenStatsFrom)
    }

    // Check if trust is the transaction receiver
    if(trustTo != null) {
        let TokenStatsTo = updateCommonTokenStats(
        asset.id,
        asset.symbol,
        AddrTo
        )
        TokenStatsTo.balance = TokenStatsTo.balance.plus(
            event.params.value
                .toBigDecimal()
                .div(TokenDecimalsBD)
                .truncate(TokenDecimals as i32),
        )
        TokenStatsTo.category = DeFiCategory.get(assetID) as string
        TokenStatsTo.trustID = AddrTo
        TokenStatsTo.save()

        addTrustTokenAssets(event, event.params.to, TokenStatsTo)
    }
}