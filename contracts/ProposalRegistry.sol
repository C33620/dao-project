// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ProposalRegistry
/// @author Clemm
/// @notice On-chain registry of DAO-approved decisions. Only the timelock (owner)
///         can record entries, ensuring every entry corresponds to a passed
///         and executed governance proposal.
contract ProposalRegistry is Ownable {
    /// @notice Represents a single DAO-approved decision.
    struct Entry {
        uint256 id; // Auto-incremented registry entry ID
        uint256 proposalId; // Governor proposal ID that approved this entry
        string description; // Human-readable description of the decision
        address proposer; // Address of the original proposal creator
        uint256 timestamp; // Block timestamp when the entry was recorded
    }

    /// @notice Total number of entries recorded.
    uint256 public entryCount;

    /// @notice Registry entries by their sequential ID (1-indexed).
    mapping(uint256 => Entry) public entries;

    /// @notice Emitted when a new decision is recorded.
    event EntryRecorded(
        uint256 indexed id,
        uint256 indexed proposalId,
        string description,
        address indexed proposer,
        uint256 timestamp
    );

    constructor(address timelockAddress) Ownable(timelockAddress) {}

    /// @notice Records a new DAO-approved decision.
    /// @dev    Only callable by the timelock (owner).
    function recordEntry(
        uint256 proposalId,
        string calldata description,
        address proposer
    ) external onlyOwner {
        require(
            bytes(description).length > 0,
            "ProposalRegistry: empty description"
        );
        require(
            proposer != address(0),
            "ProposalRegistry: zero proposer address"
        );

        uint256 newId = ++entryCount;

        entries[newId] = Entry({
            id: newId,
            proposalId: proposalId,
            description: description,
            proposer: proposer,
            timestamp: block.timestamp
        });

        emit EntryRecorded(
            newId,
            proposalId,
            description,
            proposer,
            block.timestamp
        );
    }

    /// @notice Returns a single entry by its registry ID.
    function getEntry(uint256 id) external view returns (Entry memory) {
        require(
            id > 0 && id <= entryCount,
            "ProposalRegistry: entry does not exist"
        );
        return entries[id];
    }
}
