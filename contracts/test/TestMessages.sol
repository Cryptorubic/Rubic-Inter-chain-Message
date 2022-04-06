pragma solidity >=0.8.9;

import '../message/apps/SwapBase.sol';

contract TestMessages is SwapBase {
    constructor() SwapBase(address(this), address(this), 0) {}

    function getMessage(
        SwapInfoDest memory _dstSwap,
        address _receiver,
        uint64 _nonce,
        bool _nativeOut
    ) external pure returns (bytes memory) {
        bytes memory message = abi.encode(
            SwapRequestDest({swap: _dstSwap, receiver: _receiver, nonce: _nonce, nativeOut: _nativeOut})
        );

        return message;
    }

    function getID(
        address _receiver,
        uint64 _chainId,
        uint64 _dstChainId,
        SwapInfoDest memory _dstSwap,
        uint64 _nonce,
        bool _nativeOut
    ) external pure returns (bytes32) {
        bytes memory message = abi.encode(
            SwapRequestDest({swap: _dstSwap, receiver: _receiver, nonce: _nonce, nativeOut: _nativeOut})
        );
        bytes32 id = SwapBase._computeSwapRequestId(_receiver, _chainId, _dstChainId, message);

        return id;
    }
}
