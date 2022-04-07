// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import './SwapBase.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

abstract contract TransferSwapV2 is SwapBase {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    event SwapRequestSentV2(bytes32 id, uint64 dstChainId, uint256 srcAmount, address srcToken);

    function transferWithSwapV2Native(
        address _receiver,
        uint256 _amountIn,
        uint64 _dstChainId,
        SwapInfoV2 calldata _srcSwap,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut,
        bool _disableRubic
    ) external payable onlyEOA {
        require(_srcSwap.path[0] == nativeWrap, 'token mismatch');
        require(msg.value >= _amountIn, 'Amount insufficient');
        IWETH(nativeWrap).deposit{value: _amountIn}();

        uint256 _fee = _calculateCryptoFee(msg.value - _amountIn, _dstChainId);

        _splitTransferWithSwapV2(
            SplitSwapInfoV2(
                _receiver,
                _amountIn,
                _fee,
                _dstChainId,
                _srcSwap,
                _dstSwap,
                _maxBridgeSlippage,
                _nativeOut,
                _disableRubic
            )
        );
    }

    function transferWithSwapV2(
        address _receiver,
        uint256 _amountIn,
        uint64 _dstChainId,
        SwapInfoV2 memory _srcSwap,
        SwapInfoDest memory _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut,
        bool _disableRubic
    ) external payable onlyEOA {
        IERC20(_srcSwap.path[0]).safeTransferFrom(msg.sender, address(this), _amountIn);

        uint256 _fee = _calculateCryptoFee(msg.value, _dstChainId);

        _splitTransferWithSwapV2(
            SplitSwapInfoV2(
                _receiver,
                _amountIn,
                _fee,
                _dstChainId,
                _srcSwap,
                _dstSwap,
                _maxBridgeSlippage,
                _nativeOut,
                _disableRubic
            )
        );
    }

    struct SplitSwapInfoV2 {
        address _receiver;
        uint256 _amountIn;
        uint256 _fee;
        uint64 _dstChainId;
        SwapInfoV2 _srcSwap;
        SwapInfoDest _dstSwap;
        uint32 _maxBridgeSlippage;
        bool _nativeOut;
        bool _disableRubic;
    }

    function _splitTransferWithSwapV2(SplitSwapInfoV2 memory swapInfo) private {
        nonce += 1; //TODO: use incrementer OZ
        uint64 _nonce = nonce;

        (uint64 chainId, address srcTokenOut, uint256 srcAmtOut) = _swapV2(
            swapInfo._amountIn,
            swapInfo._dstChainId,
            swapInfo._srcSwap
        );

        bytes memory message = abi.encode(
            SwapRequestDest({
                swap: swapInfo._dstSwap,
                receiver: msg.sender,
                nonce: _nonce,
                nativeOut: swapInfo._nativeOut
            })
        );

        if (swapInfo._disableRubic || srcTokenOut != rubicTransit) {
            // only celer swap
            _celerSwap(swapInfo, message, srcTokenOut, srcAmtOut, chainId, _nonce);
        } else {
            uint256 _maxSwap = maxRubicSwap; //SLOAD
            if (srcAmtOut > _maxSwap) {
                // split celer and Rubic
                uint256 cBridgePart = srcAmtOut - _maxSwap;

                _celerSwap(swapInfo, message, srcTokenOut, cBridgePart, chainId, _nonce);
                emit RubciSwapRequest(srcAmtOut - cBridgePart, message, swapInfo._nativeOut);
            } else {
                // only Rubic swap
                emit RubciSwapRequest(srcAmtOut, message, swapInfo._nativeOut);
            }
        }
    }

    /**
     * @notice Sends a cross-chain transfer via the liquidity pool-based bridge and sends a message specifying a wanted swap action on the
               destination chain via the message bus
     * @param _amountIn the input amount that the user wants to swap and/or bridge
     * @param _dstChainId destination chain ID
     * @param _srcSwap a struct containing swap related requirements
     */
    function _swapV2(
        uint256 _amountIn,
        uint64 _dstChainId,
        SwapInfoV2 memory _srcSwap
    )
        private
        returns (
            uint64,
            address,
            uint256
        )
    {
        uint64 chainId = uint64(block.chainid);

        require(_srcSwap.path.length > 1 && _dstChainId != chainId, 'empty src swap path or same chain id');

        address srcTokenOut = _srcSwap.path[_srcSwap.path.length - 1];

        (bool success, uint srcAmtOut) = _trySwapV2(_srcSwap, _amountIn);
        if (!success) revert('src swap failed');

        require(srcAmtOut >= minSwapAmount[srcTokenOut], 'amount must be greater than min swap amount');

        return (chainId, srcTokenOut, srcAmtOut);
    }

    function _celerSwap(
        SplitSwapInfoV2 memory swapInfo,
        bytes memory message,
        address srcTokenOut,
        uint256 srcAmtOut,
        uint64 _chainId,
        uint64 _nonce
    ) private {
        require(swapInfo._dstSwap.path.length > 0 || swapInfo._dstSwap.dataInchOrPathV3.length == 0, 'empty dst swap path');

        bytes32 id = SwapBase._computeSwapRequestId(msg.sender, _chainId, swapInfo._dstChainId, message);

        sendMessageWithTransfer(
            swapInfo._receiver,
            srcTokenOut,
            srcAmtOut,
            swapInfo._dstChainId,
            _nonce,
            swapInfo._maxBridgeSlippage,
            message,
            MsgDataTypes.BridgeSendType.Liquidity,
            swapInfo._fee
        );
        emit SwapRequestSentV2(id, swapInfo._dstChainId, swapInfo._amountIn, swapInfo._srcSwap.path[0]);
    }

    function _trySwapV2(SwapInfoV2 memory _swap, uint256 _amount)
        internal
        returns (
            bool ok,
            uint256 amountOut
        )
    {
        if (!supportedDEXes.contains(_swap.dex)) {
            return (false, 0);
        }

        safeApprove(IERC20(_swap.path[0]), _amount, _swap.dex);
        try
            IUniswapV2Router02(_swap.dex).swapExactTokensForTokens(
                _amount,
                _swap.amountOutMinimum,
                _swap.path,
                address(this),
                _swap.deadline
            )
        returns (uint256[] memory amounts) {
            return (true, amounts[amounts.length - 1]);
        } catch {
            return (false, 0);
        }
    }
}
