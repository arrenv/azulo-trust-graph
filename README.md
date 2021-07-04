#Azulo Trust Subgraph

This subgraph tracks activity on trusts and transactions within Azulo's multi-sig wallets. 

The purpose is show to show transparency of Azulo's trusts through usage data. 

Built by the [Azulo](https://azulo.app) team.

### Notes
Azulo is built using Gnosis Safe Contracts.

For more information see the [Gnosis Safe docs](https://gnosis-safe.readthedocs.io/en/latest/) and/or the [docs for The Graph](https://thegraph.com/docs/).


### Networks:

- Mainnet https://thegraph.com/explorer/subgraph/arrenv/azulo-trust-graph
- Rinkeby https://thegraph.com/explorer/subgraph/arrenv/azulo-trust-graph-rinkeby

## Prerequiste

- yarn
```
install yarn
```

- graph-cli

```
yarn global add @graphprotocol/graph-cli
```

## Getting started

0. Get the source and install the dependencies

```
yarn install
```

1. Build

```
yarn prepare:mainnet
yarn codegen
yarn build
```

## Deployment

1. Authenticate to a graph node

```
$ graph auth https://api.thegraph.com/deploy/ <token>
```

2. Deploy

```
graph deploy --node https://api.thegraph.com/deploy/ --ipfs https://api.thegraph.com/ipfs/ <github username>/<project name>
```

## Model

- Wallet
    -  Transaction

## Query samples

### Get Wallet details

```graphql
{
  trust(id: "0x12312312.....") {
    id
    creator
    network
    stamp
    hash
    factory
    owners
    threshold
    transactions {
      id
      stamp
      hash
      status
      value
      destination
      data
      signatures
      nonce
      operation
      estimatedSafeTxGas
      estimatedBaseGas
      estimatedGasPrice
      gasToken
      refundReceiver
      gasUsed
      gasPrice
    }
  }
}

