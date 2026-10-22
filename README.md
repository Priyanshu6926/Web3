# OpenFund

**A transparent, all-or-nothing crowdfunding protocol built for the open web.** OpenFund pairs a clean Next.js experience with an EVM escrow contract. Creators set a goal and deadline; contributors fund the campaign; after the deadline the creator claims a successful campaign, while contributors reclaim funds from a failed one.

> Portfolio project, currently in development. With no contract address configured, the UI shows clearly labeled sample cards. Once you configure a deployed Sepolia address, it reads campaign events and state and enables create, contribute, withdraw, and refund transactions. This repo has not been deployed; do not send funds until you deploy and verify your own instance.

## Why this project

The reference project demonstrates the core crowdfunding loop with React, Solidity, and MetaMask. OpenFund keeps that useful idea and develops it as an interview-ready engineering project: modern Next.js App Router + TypeScript frontend, Foundry-based Solidity workflow, explicit escrow/refund rules, event-driven observability, CI, and documented security decisions.

## Architecture

- `app/`, `components/`, `lib/`: Next.js App Router, TypeScript, RainbowKit + wagmi + viem wallet configuration (Sepolia). The campaign gallery reads `CampaignCreated` logs, loads campaign state, and supports wallet transactions.
- `contracts/src/OpenFund.sol`: permissionless campaign creation and native ETH escrow.
- `contracts/test/`: Foundry unit tests for campaign lifecycle and access conditions.
- `contracts/script/Deploy.s.sol`: minimal Foundry deployment script.
- Campaign descriptions are represented by a metadata URI. Keep media and long-form content off-chain; keep funds and campaign state on-chain. A sample metadata shape is in `public/campaign-metadata.example.json`; host the JSON on IPFS or a stable HTTPS endpoint.

## Campaign lifecycle

```text
create ──> open ──deadline──> successful ──creator withdraws once──> paid
                       └────> failed ──each contributor refunds once──> refunded
```

The campaign deadline is 1–90 days. Contributions are accepted only before the deadline. Once the deadline passes, success is determined by `raised >= goal`. Successful funds are pull-claimed by the creator; failed contributions are pull-refunded individually. This avoids loops over contributors and applies checks-effects-interactions before external ETH transfers.

## Run locally

Requirements: Node.js 22+, npm, Foundry (`forge`/`cast`), a browser wallet, and a WalletConnect project ID for WalletConnect sessions. Set `NEXT_PUBLIC_CAMPAIGN_FACTORY_ADDRESS` to your deployed Sepolia contract and `NEXT_PUBLIC_DEPLOYMENT_BLOCK` to its deployment block to enable live interactions. Without the address, sample cards are clearly labeled preview content.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

For contract tests:

```bash
cd contracts
forge test -vvv
```

For a local chain, use `anvil`, then deploy with a local private key via `forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast`.

For Sepolia, configure `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in your shell, then use the same command with `--verify` and an explorer key configured in Foundry. Never commit secrets. Update the frontend contract address only after deployment and verification.

## Engineering decisions and tradeoffs

- **Pull payments:** no unbounded contributor loop during settlement; users initiate their own refund.
- **Single-use claims:** state is updated before external calls; a failed transfer reverts the state change atomically.
- **Native ETH only:** reduces token approval and accounting complexity for a focused MVP. ERC-20 support is a deliberate future extension.
- **Metadata URI:** on-chain storage remains compact; production metadata should be content-addressed and pinned redundantly.
- **No admin key:** creators and contributors interact under deterministic rules; no operator can redirect escrow.
- **No live indexer yet:** a production deployment should index `CampaignCreated`, `ContributionReceived`, `RefundClaimed`, and `FundsWithdrawn` for fast discovery while treating contract state as authoritative.

## Next milestones

1. Add metadata upload/pinning and a dedicated campaign detail page.
2. Add invariant/fuzz tests, static analysis (Slither), and gas snapshots.
3. Deploy to Sepolia, verify source, and publish the deployment address and explorer links.
4. Add an event indexer for larger campaign histories and production hosting.

## Resume framing

**OpenFund — On-chain crowdfunding dApp** · Solidity, Foundry, Next.js, TypeScript, wagmi, viem

Built an all-or-nothing ETH crowdfunding protocol with deadline-based settlement, escrowed contributions, pull refunds, and one-time creator withdrawals. Added lifecycle tests and CI; implemented wallet-enabled Sepolia discovery and lifecycle transactions. Deployment and security review remain future work.

## License

MIT. See [LICENSE](LICENSE).
