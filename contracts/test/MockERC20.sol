// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    bool public failTransfer;

    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }

    function setFailTransfer(bool value) external {
        failTransfer = value;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        if (failTransfer) return false;
        require(balanceOf[msg.sender] >= value, "insufficient");
        unchecked {
            balanceOf[msg.sender] -= value;
            balanceOf[to] += value;
        }
        return true;
    }
}
