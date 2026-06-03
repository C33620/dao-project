// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RejectingReceiver {
    receive() external payable {
        revert("no eth");
    }
}
