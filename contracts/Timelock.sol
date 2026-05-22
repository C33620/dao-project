// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title MyTimelockController
/// @notice Timelock used by the DAO Governor to delay execution of approved proposals.
/// @dev Security notes:
/// - The Governor should be granted PROPOSER_ROLE after deployment, and ideally
///   EXECUTOR_ROLE and CANCELLER_ROLE as well for GovernorTimelockControl setups.
/// - Any temporary admin used for deployment/setup should promptly renounce
///   DEFAULT_ADMIN_ROLE once role configuration is complete.
/// - Avoid adding extra proposers besides the Governor unless you intentionally
///   want those accounts to have the power to queue and potentially interfere
///   with governance operations.

/// @title MyTimelockController
/// @author Clemm
/// @notice Timelock used by the DAO Governor to delay execution of approved proposals.
contract MyTimelockController is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
