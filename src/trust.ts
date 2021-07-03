import { GnosisSafe, AddedOwner, RemovedOwner, ChangedThreshold,
    ExecutionSuccess, ExecutionFailure, ExecTransactionCall } from '../generated/templates/GnosisSafe/GnosisSafe'
import { Trust, Transaction, Bundle, Asset } from '../generated/schema'
import { oneBigInt, concat, zeroBigInt, ZERO_BD } from './utils'
import { log, Address, Bytes, crypto, ByteArray, BigDecimal } from '@graphprotocol/graph-ts'
import { updateAzuloTrustDaily } from './dailyUpdates'

export function handleAddedOwner(event: AddedOwner): void {
    let trustAddr = event.address
    let trust = Trust.load(trustAddr.toHex())

    if(trust != null) {
        let owners = trust.owners
        owners.push(event.params.owner)
        trust.owners = owners
        trust.save()

    } else {
        log.warning("handleAddedOwner::Trust {} not found", [trustAddr.toHexString()])
    }
}

export function handleRemovedOwner(event: RemovedOwner): void {
    let trustAddr = event.address
    let trust = Trust.load(trustAddr.toHex())

    if(trust != null) {
        let owners = trust.owners
        let index = owners.indexOf(event.params.owner, 0)
        if (index > -1) {
            owners.splice(index, 1)
        }
        trust.owners = owners
        trust.save()

    } else {
        log.warning("handleRemovedOwner::Trust {} not found", [trustAddr.toHexString()])
    }
}

export function handleChangedThreshold(event: ChangedThreshold): void {
    let trustAddr = event.address
    let trust = Trust.load(trustAddr.toHex())

    if(trust != null) {
        trust.threshold = event.params.threshold
        trust.save()

    } else {
        log.warning("handleChangedThreshold::Trust {} not found", [trustAddr.toHexString()])
    }
}

export function handleExecutionSuccess(event: ExecutionSuccess): void {
    let trustAddr = event.address
    let trust = Trust.load(trustAddr.toHex())
    
    // let asset = Asset.load(pair.token0)

    // get total amounts of derived USD and ETH for tracking
    let bundle = Bundle.load('1')
    // let derivedAmountETH = token1.derivedETH
    // .times(amount1Total)
    // .plus(asset.derivedETH.times(amount0Total))
    // .div(BigDecimal.fromString('2'))
    // let derivedAmountUSD = derivedAmountETH.times(bundle.ethPrice)
    
    let derivedAmountUSD = BigDecimal.fromString('2').times(bundle.ethPrice) // DEV Temp for testing

    // only accounts for volume through white listed tokens
    // let trackedAmountUSD = getTrackedVolumeUSD(amountTotal, asset as Asset)
    
    let trackedAmountUSD = BigDecimal.fromString('2').div(BigDecimal.fromString('2'))  // DEV Temp for testing

    log.warning("handleExecutionSuccess::Trust {} not found", [trustAddr.toHexString()])

    let trackedAmountETH: BigDecimal
    if (bundle.ethPrice.equals(ZERO_BD)) {
        trackedAmountETH = ZERO_BD
    } else {
        trackedAmountETH = trackedAmountUSD.div(bundle.ethPrice)
    }

    if(trust != null) {
        let transaction = getTransaction(trustAddr, event.params.txHash)
        transaction.status = "EXECUTED"
        transaction.block = event.block.number
        transaction.hash = event.transaction.hash
        transaction.stamp = event.block.timestamp
        transaction.txhash = event.params.txHash
        transaction.payment = event.params.payment
        transaction.save()

        trust = addTransactionToTrust(<Trust> trust, transaction)
        trust.save()

        // update day entities
        let azuloDayData = updateAzuloTrustDaily(event)

        azuloDayData.dailyVolumeUSD = azuloDayData.dailyVolumeUSD.plus(trackedAmountUSD)
        azuloDayData.dailyVolumeETH = azuloDayData.dailyVolumeETH.plus(trackedAmountETH)
        azuloDayData.dailyVolumeUntracked = azuloDayData.dailyVolumeUntracked.plus(derivedAmountUSD)
        azuloDayData.save()

    } else {
        log.warning("handleExecutionSuccess::Trust {} not found", [trustAddr.toHexString()])
    }
}


export function handleExecutionFailure(event: ExecutionFailure): void {
    let trustAddr = event.address
    let trust = Trust.load(trustAddr.toHex())

    if(trust != null) {
        let transaction = getTransaction(trustAddr, event.params.txHash)
        transaction.status = "FAILED"
        transaction.block = event.block.number
        transaction.hash = event.transaction.hash
        transaction.stamp = event.block.timestamp
        transaction.txhash = event.params.txHash
        transaction.payment = event.params.payment
        transaction.save()

        trust = addTransactionToTrust(<Trust> trust, transaction)
        trust.save()

    } else {
        log.warning("handleExecutionFailure::Trust {} not found", [trustAddr.toHexString()])
    }
}

export function handleExecTransaction(call: ExecTransactionCall): void {
    let trustAddr = call.to
    let trust = Trust.load(trustAddr.toHex())

    let trustInstance = GnosisSafe.bind(trustAddr)

    if(trust != null) {
        let currentNonce = trustInstance.nonce()
        let nonce = currentNonce.equals(zeroBigInt()) ? currentNonce : currentNonce.minus(oneBigInt())
        let txHash = trustInstance.getTransactionHash(
            call.inputs.to,
            call.inputs.value,
            call.inputs.data,
            call.inputs.operation,
            call.inputs.safeTxGas,
            call.inputs.baseGas,
            call.inputs.gasPrice,
            call.inputs.gasToken,
            call.inputs.refundReceiver,
            nonce)

        let transaction = getTransaction(trustAddr, txHash)

        if(call.inputs.data.length < 2700) { // max size of a column. In some very rare cases, the method data bytecode is very long
            transaction.data = call.inputs.data
        } else {
            log.warning("trust: {} transaction {} - cannot store transaction.data (too long), length: {}",
                        [trustAddr.toHexString(), call.transaction.hash.toHexString(), ByteArray.fromI32(call.inputs.data.length).toHexString()])
        }
        transaction.value = call.inputs.value
        transaction.destination = call.inputs.to
        transaction.signatures = call.inputs.signatures
        transaction.nonce = nonce
        transaction.operation = (call.inputs.operation == 0) ? "CALL" : "DELEGATE_CALL"
        transaction.estimatedSafeTxGas = call.inputs.safeTxGas
        transaction.estimatedBaseGas = call.inputs.baseGas
        transaction.gasToken = call.inputs.gasToken
        transaction.gasPrice =  call.inputs.gasPrice
        transaction.refundReceiver = call.inputs.refundReceiver
        transaction.save()

        trust = addTransactionToTrust(<Trust> trust, transaction)
        trust.save()

    } else {
        log.warning("handleExecTransaction::Trust {} not found", [trustAddr.toHexString()])
    }
}




/*
 * UTILS
 */

function getTransaction(trust: Address, transctionHash: Bytes): Transaction {
    let id = crypto.keccak256(concat(trust, transctionHash))

    let transaction = Transaction.load(id.toHexString())
    if(transaction == null) {
        transaction = new Transaction(id.toHexString())
    }

    return transaction as Transaction
}

function addTransactionToTrust(trust: Trust, transaction: Transaction): Trust {
    let transactions = trust.transactions

    if (transactions.indexOf(transaction.id, 0) == -1) {
        transactions.push(transaction.id)
        trust.transactions = transactions
    }

    return trust
}
