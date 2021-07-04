import { GnosisSafe, AddedOwner, RemovedOwner, ChangedThreshold,
    ExecutionSuccess, ExecutionFailure, ExecTransactionCall } from '../generated/templates/GnosisSafe/GnosisSafe'
import { Trust, Transaction, Bundle, Asset, AzuloTrustFactory, TrustToken } from '../generated/schema'
import { oneBigInt, concat, zeroBigInt, ZERO_BD, TRUST_FACTORY_ADDRESS } from './utils'
import { log, Address, Bytes, crypto, ByteArray, BigDecimal } from '@graphprotocol/graph-ts'
import { addAzuloBeneficiaryDaily, updateAzuloTrustDailyValue } from './dailyUpdates'
import { getEthPriceInUSD, findEthPerToken } from './pricing'
import { Transfer } from '../generated/DAI/Token'

export function handleAddedOwner(event: AddedOwner): void {
    let trustAddr = event.address
    let trust = Trust.load(trustAddr.toHex())

    if(trust != null) {
        let owners = trust.owners
        owners.push(event.params.owner)
        trust.owners = owners
        trust.save()

        // load factory and add trustee/beneficiary
        let trustFactory = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
        trustFactory.totalBeneficiaries = trustFactory.totalBeneficiaries + 1
        trustFactory.save()

        addAzuloBeneficiaryDaily(event)

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

        // load factory and remove trustee/beneficiary
        let trustFactory = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
        if (trustFactory.totalBeneficiaries > 0) {
            trustFactory.totalBeneficiaries = trustFactory.totalBeneficiaries - 1
            trustFactory.save()
        }

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

export function addTrustTokenAssets(event: Transfer, trustAddress: Address, trustToken: TrustToken): void {
    let trust = Trust.load(trustAddress.toHex())
    let asset = Asset.load(trustToken.asset)

    let tokenDerivedETH = findEthPerToken(asset as Asset).times(trustToken.balance)
    let tokenDerivedUSD = getEthPriceInUSD().times(tokenDerivedETH)

    // Add value to trust
    trust.totalAssetsETH = trust.totalAssetsETH.plus(tokenDerivedETH)
    trust.totalAssetsUSD = trust.totalAssetsUSD.plus(tokenDerivedUSD)
    trust.save()
    
    // Add value to all trusts
    // load factory
    let trustFactory = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
    trustFactory.totalVolumeUSD = trustFactory.totalVolumeUSD.plus(trust.totalAssetsUSD)
    trustFactory.totalVolumeETH = trustFactory.totalVolumeETH.plus(trust.totalAssetsETH)
    trustFactory.totalWealthUSD = trustFactory.totalWealthUSD.plus(trust.totalAssetsUSD)
    trustFactory.totalWealthETH = trustFactory.totalWealthETH.plus(trust.totalAssetsETH)
    trustFactory.save()

    updateAzuloTrustDailyValue(event, tokenDerivedETH, tokenDerivedUSD)

}

export function subtractTrustTokenAssets(event: Transfer, trustAddress: Address, trustToken: TrustToken): void {
    let trust = Trust.load(trustAddress.toHex())
    let asset = Asset.load(trustToken.asset)

    let tokenDerivedETH = findEthPerToken(asset as Asset).times(trustToken.balance)
    let tokenDerivedUSD = getEthPriceInUSD().times(tokenDerivedETH)

    // Subtract value from trust - check if not negative number
    if (trust.totalAssetsETH.minus(tokenDerivedETH) > ZERO_BD) {
        trust.totalAssetsETH = trust.totalAssetsETH.minus(tokenDerivedETH)
    } else {
        trust.totalAssetsETH = ZERO_BD
    }
    if (trust.totalAssetsUSD.minus(tokenDerivedUSD) > ZERO_BD) {
        trust.totalAssetsUSD = trust.totalAssetsUSD.minus(tokenDerivedUSD)
    } else {
        trust.totalAssetsUSD = ZERO_BD
    }
    
    trust.save()
    
    // Add value to all trusts
    // load factory
    let trustFactory = AzuloTrustFactory.load(TRUST_FACTORY_ADDRESS)
    trustFactory.totalVolumeUSD = trustFactory.totalVolumeUSD.plus(trust.totalAssetsUSD)
    trustFactory.totalVolumeETH = trustFactory.totalVolumeETH.plus(trust.totalAssetsETH)
    if (trustFactory.totalWealthETH.plus(trust.totalAssetsETH) > ZERO_BD) {
        trustFactory.totalWealthETH = trustFactory.totalWealthETH.minus(trust.totalAssetsETH)
    } else {
        trustFactory.totalWealthETH = ZERO_BD
    }
    if (trustFactory.totalWealthUSD.minus(trust.totalAssetsUSD) > ZERO_BD) {
        trustFactory.totalWealthUSD = trustFactory.totalWealthUSD.minus(trust.totalAssetsUSD)
    } else {
        trustFactory.totalWealthUSD = ZERO_BD
    }
    trustFactory.save()

    updateAzuloTrustDailyValue(event, tokenDerivedETH, tokenDerivedUSD)

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