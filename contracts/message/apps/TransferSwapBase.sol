// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import 'rubic-bridge-base/contracts/libraries/SmartApprove.sol';
import './SwapBase.sol';

contract TransferSwapBase is SwapBase {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    function _deriveFeeAndPerformChecksNative(
        uint256 _amountIn,
        uint64 _dstChainId,
        address _integrator,
        /// Different
        address srcInputToken //TODO: possible to remove this parameter at all?
    ) internal onlyEOA whenNotPaused returns(uint256 _fee){
        require(srcInputToken == nativeWrap, 'token mismatch');
        require(msg.value >= _amountIn, 'Amount insufficient');
        IWETH(nativeWrap).deposit{value: _amountIn}();

        _fee = msg.value - _amountIn - accrueFixedAndGasFees(_integrator, integratorToFeeInfo[_integrator], _dstChainId);
    }

    function _deriveFeeAndPerformChecks(
        uint256 _amountIn,
        uint64 _dstChainId,
        address _integrator,
        /// Different
        address srcInputToken
    ) internal onlyEOA whenNotPaused returns(uint256 _fee){
        IERC20Upgradeable(srcInputToken).safeTransferFrom(msg.sender, address(this), _amountIn);

        _fee = msg.value - accrueFixedAndGasFees(_integrator, integratorToFeeInfo[_integrator], _dstChainId);
    }

    function _beforeSwapAndSendMessage() internal returns (uint64) {
        return ++nonce;
    }

    function _retrieveDstTokenAddress(SwapInfoDest memory _swapInfo) internal pure returns(address) {
        if (_swapInfo.version == SwapVersion.v3) {
            require(_swapInfo.pathV3.length > 20, 'dst swap expected');

            return address(_getLastBytes20(_swapInfo.pathV3));
        } else if (_swapInfo.version == SwapVersion.v2) {
            require(_swapInfo.path.length > 1, 'dst swap expected');

            return _swapInfo.path[_swapInfo.path.length -1];
        } else {
            return _swapInfo.path[_swapInfo.path.length -1];
        }
    }

    function _sendMessage(
        address _receiver,
        uint64 _chainId,
        uint64 _dstChainId,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        uint64 _nonce,
        uint256 _fee,
        address _srcOutputToken,
        uint256 _srcAmtOut,
        bool _success
    ) internal returns(bytes32 id){
        if (!_success) revert('src swap failed');

        require(_srcAmtOut >= minTokenAmount[_srcOutputToken], 'less than min');
        require(_srcAmtOut <= maxTokenAmount[_srcOutputToken], 'greater than max'); //TODO: check for zero

        id = _crossChainTransferWithSwap(
            _receiver,
            _chainId,
            _dstChainId,
            _dstSwap,
            _maxBridgeSlippage,
            _nonce,
            _fee,
            _srcOutputToken,
            _srcAmtOut
        );
    }

    function _crossChainTransferWithSwap(
        address _receiver,
        uint64 _chainId,
        uint64 _dstChainId,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        uint64 _nonce,
        uint256 _fee,
        address srcOutputToken,
        uint256 srcAmtOut
    ) private returns(bytes32 id) {
        require(_dstSwap.path.length > 0, 'empty dst swap path');
        bytes memory message = abi.encode(
            SwapRequestDest({swap: _dstSwap, receiver: msg.sender, nonce: nonce, dstChainId: _dstChainId})
        );
        id = _computeSwapRequestId(msg.sender, _chainId, _dstChainId, message);

        sendMessageWithTransfer(
            _receiver,
            srcOutputToken,
            srcAmtOut,
            _dstChainId,
            _nonce,
            _maxBridgeSlippage,
            message,
            MsgDataTypes.BridgeSendType.Liquidity,
            _fee
        );
    }
}
