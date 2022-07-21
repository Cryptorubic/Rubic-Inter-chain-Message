// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import 'rubic-bridge-base/contracts/architecture/WithDestinationFunctionality.sol';

import '../framework/MessageSenderApp.sol';
import '../framework/MessageReceiverApp.sol';
import '../../interfaces/IWETH.sol';

contract SwapBase is MessageSenderApp, MessageReceiverApp, WithDestinationFunctionality {
    using SafeERC20 for IERC20;

    bytes32 public constant EXECUTOR_ROLE = keccak256('EXECUTOR_ROLE'); // todo remove

    address public nativeWrap;
    uint64 public nonce;

    // ============== struct for V2 like dexes ==============

    struct SwapInfoV2 {
        address dex; // the DEX to use for the swap
        // if this array has only one element, it means no need to swap
        address[] path;
        // the following fields are only needed if path.length > 1
        uint256 deadline; // deadline for the swap
        uint256 amountOutMinimum; // minimum receive amount for the swap
    }

    // ============== struct for V3 like dexes ==============

    struct SwapInfoV3 {
        address dex; // the DEX to use for the swap
        bytes path;
        uint256 deadline;
        uint256 amountOutMinimum;
    }

    // ============== struct for inch swap ==============

    struct SwapInfoInch {
        address dex;
        // path is tokenIn, tokenOut
        address[] path;
        bytes data;
        uint256 amountOutMinimum;
    }

    // ============== struct dstSwap ==============
    // This is needed to make v2 -> SGN -> v3 swaps and etc.

    struct SwapInfoDest {
        address dex; // dex address
        bool nativeOut;
        address integrator;
        SwapVersion version; // identifies swap type
        address[] path; // path address for v2 and inch
        bytes pathV3; // path address for v3
        uint256 deadline; // for v2 and v3
        uint256 amountOutMinimum;
    }

    struct SwapRequestDest {
        SwapInfoDest swap;
        address receiver; // EOA
        uint64 nonce;
        uint64 dstChainId;
    }

    enum SwapVersion {
        v2,
        v3,
        bridge
    }

    // returns address of first token for V3
    function _getFirstBytes20(bytes memory input) internal pure returns (bytes20 result) {
        assembly {
            result := mload(add(input, 32))
        }
    }

    // returns address of tokenOut for V3
    function _getLastBytes20(bytes memory input) internal pure returns (bytes20 result) {
        uint256 offset = input.length + 12;
        assembly {
            result := mload(add(input, offset))
        }
    }

    function _computeSwapRequestId(
        address _sender,
        uint64 _srcChainId,
        uint64 _dstChainId,
        bytes memory _message
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_sender, _srcChainId, _dstChainId, _message));
    }

    // ============== fee logic ==============

    function _calculateCryptoFee(uint256 _fee, uint64 _dstChainId) internal view returns (uint256 updatedFee) {
        require(_fee >= blockchainToGasFee[_dstChainId], 'too few crypto fee');
        uint256 _updatedFee = _fee - blockchainToGasFee[_dstChainId];
        return (_updatedFee);
    }
}
