import { ProxyCreation } from '../generated/GnosisSafeProxyFactory/GnosisSafeProxyFactory'
import { GnosisSafe  } from '../generated/templates/GnosisSafe/GnosisSafe'
import { Trust } from '../generated/schema'
import { GnosisSafe as GnosisSafeContract } from '../generated/templates'
import { updateAzuloTrustDaily } from './dailyUpdates'
import { log, Bytes, dataSource, Address, BigDecimal } from '@graphprotocol/graph-ts'
import { ZERO_BD } from './utils'

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
    trust.threshold           = safeInstance.getThreshold()
    trust.totalAssetsUSD      = ZERO_BD
    trust.totalAssetsETH      = ZERO_BD
    trust.transactions        = []
    trust.save()

    // Instantiate a new datasource
    GnosisSafeContract.create(trustAddr)

  } else {
    // A trust can be instanTiated from the proxy with incorrect setup values
    // The trust is still deployed but unusable
    // e.g https://etherscan.io/tx/0x087226bfdc7d5ff7e64fec3f4fc87522986213265fa835f22208cae83b9259a8#eventlog
    log.warning("Trust {} is incorrect (tx: {})",
                [trustAddr.toHexString(), event.transaction.hash.toHexString()])
  }
}