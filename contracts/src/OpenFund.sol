// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title OpenFund — permissionless all-or-nothing crowdfunding campaigns.
/// @notice Each contribution is escrowed until the deadline. Failed campaigns
///         refund contributors; successful campaigns let the creator claim once.
contract OpenFund {
    uint64 public constant MIN_DURATION = 1 days;
    uint64 public constant MAX_DURATION = 90 days;
    uint256 public nextCampaignId;

    struct Campaign {
        address payable creator;
        uint64 deadline;
        uint128 goal;
        uint128 raised;
        bool claimed;
        string metadataURI;
    }

    mapping(uint256 id => Campaign) public campaigns;
    mapping(uint256 id => mapping(address contributor => uint256 amount)) public contributions;

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goal, uint64 deadline, string metadataURI);
    event ContributionReceived(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised);
    event RefundClaimed(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, address indexed creator, uint256 amount);

    error InvalidGoal();
    error InvalidDuration();
    error MetadataRequired();
    error CampaignNotOpen();
    error ZeroContribution();
    error GoalNotReached();
    error CampaignStillOpen();
    error NoRefundAvailable();
    error AlreadyClaimed();
    error TransferFailed();

    function createCampaign(uint128 goal, uint64 duration, string calldata metadataURI) external returns (uint256 id) {
        if (goal == 0) revert InvalidGoal();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
        if (bytes(metadataURI).length == 0 || bytes(metadataURI).length > 200) revert MetadataRequired();
        uint256 deadline = block.timestamp + duration;
        if (deadline > type(uint64).max) revert InvalidDuration();
        id = nextCampaignId++;
        campaigns[id] = Campaign(payable(msg.sender), uint64(deadline), goal, 0, false, metadataURI);
        emit CampaignCreated(id, msg.sender, goal, uint64(deadline), metadataURI);
    }

    function contribute(uint256 id) external payable {
        Campaign storage campaign = campaigns[id];
        if (campaign.creator == address(0) || block.timestamp >= campaign.deadline) revert CampaignNotOpen();
        if (msg.value == 0) revert ZeroContribution();
        uint256 total = uint256(campaign.raised) + msg.value;
        if (total > type(uint128).max) revert InvalidGoal();
        campaign.raised = uint128(total);
        contributions[id][msg.sender] += msg.value;
        emit ContributionReceived(id, msg.sender, msg.value, total);
    }

    function withdraw(uint256 id) external {
        Campaign storage campaign = campaigns[id];
        if (msg.sender != campaign.creator) revert CampaignNotOpen();
        if (block.timestamp < campaign.deadline) revert CampaignStillOpen();
        if (campaign.raised < campaign.goal) revert GoalNotReached();
        if (campaign.claimed) revert AlreadyClaimed();
        campaign.claimed = true; // effects before interaction; prevents reentrancy and repeat claims.
        uint256 amount = campaign.raised;
        emit FundsWithdrawn(id, campaign.creator, amount);
        (bool ok,) = campaign.creator.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function refund(uint256 id) external {
        Campaign storage campaign = campaigns[id];
        if (campaign.creator == address(0) || block.timestamp < campaign.deadline) revert CampaignStillOpen();
        if (campaign.raised >= campaign.goal) revert GoalNotReached();
        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert NoRefundAvailable();
        contributions[id][msg.sender] = 0; // checks-effects-interactions
        emit RefundClaimed(id, msg.sender, amount);
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) { return campaigns[id]; }
}
