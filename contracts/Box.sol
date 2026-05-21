// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Box is Ownable {
    uint256 private _value;

    constructor() Ownable(msg.sender) {}

    function store(uint256 value) external onlyOwner {
        _value = value;
    }

    function retrieve() external view returns (uint256) {
        return _value;
    }
}
