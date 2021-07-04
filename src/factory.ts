import { ProxyCreation } from '../generated/GnosisSafeProxyFactory/GnosisSafeProxyFactory'
import { GnosisSafe } from '../generated/templates/GnosisSafe/GnosisSafe'
import { Trust, Bundle, AzuloTrustFactory } from '../generated/schema'
import { GnosisSafe as GnosisSafeContract } from '../generated/templates'
import { updateAzuloTrustDaily } from './dailyUpdates'
import { log, Bytes, dataSource, Address, BigDecimal } from '@graphprotocol/graph-ts'
import { ZERO_BD, ZERO_BI, TRUST_FACTORY_ADDRESS } from './utils'

export function handleProxyCreation(event: ProxyCreation): void {

  let trustAddr = event.params.proxy
  let safeInstance = GnosisSafe.bind(trustAddr)

  let callGetOwnerResult = safeInstance.try_getOwners()
  if(!callGetOwnerResult.reverted) {
    let trust = new Trust(trustAddr.toHex())
    trust.creator             = event.transaction.from
    trust.network             = dataSource.network()
    trust.stamp               = event.block.timestamp
    trust.hash                = event.transaction.hash
    trust.factory             = event.address as Address
    trust.owners              = callGetOwnerResult.value as Bytes[]
    trust.threshold           = safeInstance.getThreshold()
    trust.totalAssetsUSD      = ZERO_BD
    trust.totalAssetsETH      = ZERO_BD
    trust.transactions        = []
    trust.save()

    // Instantiate a new datasource
    GnosisSafeContract.create(trustAddr)

    // load factory (create if first exchange)
    let trustFactory = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
    if (trustFactory === null) {
      trustFactory = new AzuloTrustFactory(TRUST_FACTORY_ADDRESS)
      trustFactory.totalTrusts = 0
      trustFactory.totalBeneficiaries = 0
      trustFactory.totalVolumeETH = ZERO_BD
      trustFactory.totalVolumeUSD = ZERO_BD
      trustFactory.untrackedVolumeUSD = ZERO_BD
      trustFactory.totalWealthUSD = ZERO_BD
      trustFactory.totalWealthETH = ZERO_BD
      trustFactory.txCount = ZERO_BI

      // create new bundle
      let bundle = new Bundle('1')
      bundle.ethPrice = ZERO_BD
      bundle.save()
    }
    trustFactory.totalTrusts = trustFactory.totalTrusts + 1
    trustFactory.save()

    updateAzuloTrustDaily(event)

    // let azulo = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
    // let timestamp = event.block.timestamp.toI32()
    // let dayID = timestamp / 86400
    // let dayStartTimestamp = dayID * 86400
    // let azuloDayData = AzuloTrustDaily.load(dayID.toString())
    // if (azuloDayData === null) {
    //   azuloDayData = new AzuloTrustDaily(dayID.toString())
    //   azuloDayData.date = dayStartTimestamp
    //   azuloDayData.dailyVolumeUSD = ZERO_BD
    //   azuloDayData.dailyVolumeETH = ZERO_BD
    //   azuloDayData.totalVolumeUSD = ZERO_BD
    //   azuloDayData.totalVolumeETH = ZERO_BD
    //   azuloDayData.dailyVolumeUntracked = ZERO_BD
    // }
  
    // azuloDayData.txCount = azulo.txCount
    // azuloDayData.save()

  } else {
    // A trust can be instanTiated from the proxy with incorrect setup values
    // The trust is still deployed but unusable
    // e.g https://etherscan.io/tx/0x087226bfdc7d5ff7e64fec3f4fc87522986213265fa835f22208cae83b9259a8#eventlog
    log.warning("Trust {} is incorrect (tx: {})",
                [trustAddr.toHexString(), event.transaction.hash.toHexString()])
  }
}