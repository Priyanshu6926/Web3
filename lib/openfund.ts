import { parseAbi, parseAbiItem } from 'viem';

export const openFundAbi = parseAbi([
  'function nextCampaignId() view returns (uint256)',
  'function getCampaign(uint256 id) view returns ((address creator,uint64 deadline,uint128 goal,uint128 raised,bool claimed,string metadataURI))',
  'function contributions(uint256 id,address contributor) view returns (uint256)',
  'function createCampaign(uint128 goal,uint64 duration,string metadataURI) returns (uint256 id)',
  'function contribute(uint256 id) payable',
  'function withdraw(uint256 id)',
  'function refund(uint256 id)',
  'event CampaignCreated(uint256 indexed campaignId,address indexed creator,uint256 goal,uint64 deadline,string metadataURI)',
  'error InvalidGoal()', 'error InvalidDuration()', 'error MetadataRequired()',
  'error CampaignNotOpen()', 'error ZeroContribution()', 'error GoalNotReached()',
  'error CampaignStillOpen()', 'error NoRefundAvailable()', 'error AlreadyClaimed()', 'error TransferFailed()'
]);

export const campaignCreatedEvent = parseAbiItem(
  'event CampaignCreated(uint256 indexed campaignId,address indexed creator,uint256 goal,uint64 deadline,string metadataURI)'
);

export const contractAddress = process.env.NEXT_PUBLIC_CAMPAIGN_FACTORY_ADDRESS as `0x${string}` | undefined;
export const deploymentBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || '0');
