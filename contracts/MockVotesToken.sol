// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title MockVotesToken
/// @author Clemm
/// @notice Mock ERC20Votes token used only for testing governance flows.
contract MockVotesToken is ERC20, ERC20Permit, ERC20Votes {
    constructor() ERC20("MockVotesToken", "MVT") ERC20Permit("MockVotesToken") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /// @notice Mints mock tokens for testing.
    /// @param to The address receiving the tokens.
    /// @param amount The amount of tokens to mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    /// @notice Returns the nonce for a permit owner.
    /// @param owner The owner address.
    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
