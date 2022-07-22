// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import './TransferSwapBase.sol';

contract BridgeSwap is TransferSwapBase {
    using SafeERC20 for IERC20;

    function bridgeWithSwapNative(
        address _receiver,
        uint256 _amountIn,
        uint64 _dstChainId,
        address _srcBridgeToken,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage
    ) external payable {
        uint256 _fee = _deriveFeeAndPerformChecksNative(_amountIn, _dstChainId, _dstSwap.integrator, _srcBridgeToken);

        _sendBridgeMessage(_receiver, _dstChainId, _srcBridgeToken, _dstSwap, _maxBridgeSlippage, _fee, _amountIn);
    }

    function bridgeWithSwap(
        address _receiver,
        uint256 _amountIn,
        uint64 _dstChainId,
        address _srcBridgeToken,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage
    ) external payable {
        uint256 _fee = _deriveFeeAndPerformChecks(_amountIn, _dstChainId, _dstSwap.integrator, _srcBridgeToken);

        _sendBridgeMessage(_receiver, _dstChainId, _srcBridgeToken, _dstSwap, _maxBridgeSlippage, _fee, _amountIn);
    }

    function _sendBridgeMessage(
        address _receiver,
        uint64 _dstChainId,
        address _srcBridgeToken,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        uint256 _fee,
        uint256 _amountIn
    ) private {
        BaseCrossChainParams memory _baseParams = BaseCrossChainParams(
            _srcBridgeToken,
            _amountIn,
            _dstChainId,
            _retrieveDstTokenAddress(_dstSwap),
            _dstSwap.amountOutMinimum,
            msg.sender,
            _dstSwap.integrator,
            address(0)
        );

        uint64 _chainId = uint64(block.chainid);
        uint64 _nonce = _beforeSwapAndSendMessage();

        require(_baseParams.dstChainID != _chainId, 'same chain id');

        bytes32 id = _sendMessage(
            _receiver,
            _chainId,
            uint64(_baseParams.dstChainID),
            _dstSwap,
            _maxBridgeSlippage,
            _nonce,
            _fee,
            _baseParams.srcInputToken,
            _baseParams.srcInputAmount,
            true
        );

        emit CrossChainRequestSent(id, _baseParams);
    }
}
