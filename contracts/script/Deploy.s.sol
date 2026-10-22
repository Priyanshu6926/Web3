// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../src/OpenFund.sol";
interface VmScript { function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
contract Deploy {
    VmScript private constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (OpenFund deployed) {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key); deployed = new OpenFund(); vm.stopBroadcast();
    }
}
