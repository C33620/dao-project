// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Box
/// @author Clemm
/// @notice Simple storage contract used as a governance-controlled target.
contract Box is Ownable {
    uint256 private _value;

    constructor() Ownable(msg.sender) {}

    /// @notice Stores a new value in the contract.
    /// @param value The new value to store.
    function store(uint256 value) external onlyOwner {
        _value = value;
    }

    /// @notice Returns the stored value.
    function retrieve() external view returns (uint256) {
        return _value;
    }
}
