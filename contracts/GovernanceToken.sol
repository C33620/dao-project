// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title GovernanceToken
/// @author Clemm
/// @notice DAO governance token with ERC20Votes-based delegated voting power.

contract GovernanceToken is ERC20Votes, Ownable {
    /// @notice Initial token supply minted at deployment.
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    constructor(
        address initialOwner
    )
        ERC20("KyotoTechMeetupToken", "KTM")
        EIP712("KyotoTechMeetupToken", "1")
        Ownable(initialOwner)
    {
        _mint(initialOwner, INITIAL_SUPPLY);
    }
}
