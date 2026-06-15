// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CloseAccountDelegate {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    address public immutable GOVERNANCE_TOKEN;
    address public immutable MASTER_WALLET;

    uint256 public constant GAS_BUFFER = 50_000;

    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 public constant CLOSE_TYPEHASH =
        keccak256(
            "CloseAccount(address relayer,uint256 nonce,uint256 deadline)"
        );

    uint256 public closeNonce;

    error InvalidSignature();
    error SignatureExpired();
    error InvalidRelayer();
    error InvalidNonce(uint256 expected, uint256 actual);
    error InsufficientTokenBalance();
    error InsufficientEthBalance();
    error EthTransferFailed();
    error ZeroAddress();

    event CloseExecuted(
        address indexed caller,
        address indexed masterWallet,
        uint256 tokenAmount,
        uint256 ethAmountSent,
        uint256 nonce
    );

    constructor(address governanceToken, address masterWallet) {
        if (governanceToken == address(0) || masterWallet == address(0)) {
            revert ZeroAddress();
        }

        GOVERNANCE_TOKEN = governanceToken;
        MASTER_WALLET = masterWallet;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("CloseAccountDelegate")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function getCloseDigest(
        address relayer,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(CLOSE_TYPEHASH, relayer, nonce, deadline)
        );

        return
            keccak256(
                abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
            );
    }

    function closeAccount(
        address relayer,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external virtual {
        _validateClose(relayer, nonce, deadline, signature);

        closeNonce = nonce + 1;

        uint256 tokenAmountSent = _transferGovernanceTokens();

        uint256 amountToSend = _computeEthToSend();
        _sendEth(amountToSend);

        emit CloseExecuted(
            msg.sender,
            MASTER_WALLET,
            tokenAmountSent,
            amountToSend,
            nonce
        );
    }

    function _validateClose(
        address relayer,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SignatureExpired();
        if (msg.sender != relayer) revert InvalidRelayer();

        uint256 currentNonce = closeNonce;
        if (nonce != currentNonce) revert InvalidNonce(currentNonce, nonce);

        bytes32 digest = getCloseDigest(relayer, nonce, deadline);
        address recovered = _recoverSigner(digest, signature);

        if (recovered != address(this)) revert InvalidSignature();
    }

    function _recoverSigner(
        bytes32 digest,
        bytes calldata signature
    ) internal view virtual returns (address) {
        return ECDSA.recover(digest, signature);
    }

    function _transferGovernanceTokens() internal returns (uint256 amountSent) {
        uint256 tokenBal = IERC20(GOVERNANCE_TOKEN).balanceOf(address(this));
        if (tokenBal == 0) revert InsufficientTokenBalance();

        IERC20(GOVERNANCE_TOKEN).safeTransfer(MASTER_WALLET, tokenBal);
        return tokenBal;
    }

    function _computeEthToSend() internal view returns (uint256 amountToSend) {
        uint256 reserve = (gasleft() + GAS_BUFFER) * tx.gasprice;
        uint256 ethBal = address(this).balance;

        if (ethBal <= reserve) revert InsufficientEthBalance();

        amountToSend = ethBal - reserve;
    }

    function _sendEth(uint256 amountToSend) internal {
        (bool sent, ) = payable(MASTER_WALLET).call{value: amountToSend}("");
        if (!sent) revert EthTransferFailed();
    }

    receive() external payable {}
}
