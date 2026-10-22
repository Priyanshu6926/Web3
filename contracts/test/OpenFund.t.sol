// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../src/OpenFund.sol";

interface Vm { function warp(uint256) external; function deal(address, uint256) external; function prank(address) external; function expectRevert(bytes4) external; }

contract OpenFundTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    OpenFund private fund;
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);
    function setUp() public { fund = new OpenFund(); vm.deal(alice, 20 ether); vm.deal(bob, 20 ether); }

    function testCreateCampaign() public {
        uint256 id = fund.createCampaign(5 ether, 7 days, "ipfs://metadata");
        OpenFund.Campaign memory campaign = fund.getCampaign(id);
        address creator = campaign.creator; uint64 deadline = campaign.deadline; uint128 goal = campaign.goal;
        uint128 raised = campaign.raised; bool claimed = campaign.claimed; string memory uri = campaign.metadataURI;
        require(id == 0 && creator == address(this) && deadline == block.timestamp + 7 days, "campaign identity");
        require(goal == 5 ether && raised == 0 && !claimed && keccak256(bytes(uri)) == keccak256("ipfs://metadata"), "campaign data");
    }

    function testRejectInvalidCampaignParameters() public {
        vm.expectRevert(OpenFund.InvalidGoal.selector); fund.createCampaign(0, 7 days, "uri");
        vm.expectRevert(OpenFund.InvalidDuration.selector); fund.createCampaign(1 ether, 1 hours, "uri");
        vm.expectRevert(OpenFund.MetadataRequired.selector); fund.createCampaign(1 ether, 7 days, "");
    }

    function testContributionsAggregateAndEmitTotal() public {
        uint256 id = fund.createCampaign(5 ether, 7 days, "uri");
        vm.prank(alice); fund.contribute{value: 2 ether}(id);
        vm.prank(bob); fund.contribute{value: 1 ether}(id);
        require(fund.contributions(id, alice) == 2 ether && fund.contributions(id, bob) == 1 ether, "balances");
        (,,, uint128 raised,,) = fund.campaigns(id); require(raised == 3 ether, "raised total");
    }

    function testCreatorWithdrawsSuccessfulCampaignOnce() public {
        uint256 id = fund.createCampaign(2 ether, 2 days, "uri");
        vm.prank(alice); fund.contribute{value: 2 ether}(id);
        vm.warp(block.timestamp + 2 days);
        uint256 beforeBalance = address(this).balance;
        fund.withdraw(id);
        require(address(this).balance == beforeBalance + 2 ether, "payout");
        vm.expectRevert(OpenFund.AlreadyClaimed.selector); fund.withdraw(id);
    }

    function testRefundContributorWhenCampaignFails() public {
        uint256 id = fund.createCampaign(3 ether, 2 days, "uri");
        vm.prank(alice); fund.contribute{value: 1 ether}(id);
        vm.warp(block.timestamp + 2 days);
        uint256 beforeBalance = alice.balance;
        vm.prank(alice); fund.refund(id);
        require(alice.balance == beforeBalance + 1 ether && fund.contributions(id, alice) == 0, "refund");
    }

    function testCannotWithdrawBeforeDeadlineOrBelowGoal() public {
        uint256 id = fund.createCampaign(3 ether, 2 days, "uri");
        vm.expectRevert(OpenFund.CampaignStillOpen.selector); fund.withdraw(id);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(OpenFund.GoalNotReached.selector); fund.withdraw(id);
    }

    function testCannotRefundSuccessfulCampaign() public {
        uint256 id = fund.createCampaign(1 ether, 2 days, "uri");
        vm.prank(alice); fund.contribute{value: 1 ether}(id);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(OpenFund.GoalNotReached.selector); vm.prank(alice); fund.refund(id);
    }

    receive() external payable {}
}
