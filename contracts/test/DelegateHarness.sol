// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Delegate.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CloseAccountDelegateHarness is CloseAccountDelegate {
    address public testSigner;

    constructor(
        address governanceToken,
        address masterWallet,
        address signer
    ) CloseAccountDelegate(governanceToken, masterWallet) {
        testSigner = signer;
    }

    function setTestSigner(address signer) external {
        testSigner = signer;
    }

    function _recoverSigner(
        bytes32 digest,
        bytes calldata signature
    ) internal view override returns (address) {
        address recovered = ECDSA.recover(digest, signature);
        if (recovered == testSigner) {
            return address(this);
        }
        return recovered;
    }
}
