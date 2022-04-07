// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import './SwapBase.sol';
import '../../interfaces/ISwapRouter.sol';

abstract contract TransferSwapV3 is SwapBase {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    // emitted when requested dstChainId == srcChainId, no bridging
    event DirectSwapV3(
        bytes32 id,
        uint64 srcChainId,
        uint256 amountIn,
        address tokenIn,
        uint256 amountOut,
        address tokenOut
    );

    event SwapRequestSentV3(bytes32 id, uint64 dstChainId, uint256 srcAmount, address srcToken);

    function transferWithSwapV3Native(
        address _receiver, // transfer swap contract in dst chain
        uint256 _amountIn,
        uint64 _dstChainId,
        SwapInfoV3 calldata _srcSwap,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut,
        bool _disableRubic
    ) external payable onlyEOA {
        require(address(_getFirstBytes20(_srcSwap.path)) == nativeWrap, 'token mismatch');
        require(msg.value >= _amountIn, 'Amount insufficient');
        IWETH(nativeWrap).deposit{value: _amountIn}();

        uint256 _fee = _calculateCryptoFee(msg.value - _amountIn, _dstChainId);

        _splitTransferWithSwapV3(
            SplitSwapInfoV3(
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

    function transferWithSwapV3(
        address _receiver, // transfer swap contract in dst chain
        uint256 _amountIn,
        uint64 _dstChainId,
        SwapInfoV3 calldata _srcSwap,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut,
        bool _disableRubic
    ) external payable onlyEOA {
        // TODO: shall we create a var for inputToken to avoid double calculations
        // (check emit in _celerSwap() and _trySwapV3())
        IERC20(address(_getFirstBytes20(_srcSwap.path))).safeTransferFrom(msg.sender, address(this), _amountIn);

        uint256 _fee = _calculateCryptoFee(msg.value - _amountIn, _dstChainId);

        _splitTransferWithSwapV3(
            SplitSwapInfoV3(
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

    struct SplitSwapInfoV3 {
        address _receiver;
        uint256 _amountIn;
        uint256 _fee;
        uint64 _dstChainId;
        SwapInfoV3 _srcSwap;
        SwapInfoDest _dstSwap;
        uint32 _maxBridgeSlippage;
        bool _nativeOut;
        bool _disableRubic;
    }

    function _splitTransferWithSwapV3(SplitSwapInfoV3 memory swapInfo) private {
        nonce += 1; //TODO: use incrementer OZ
        uint64 _nonce = nonce;

        (uint64 chainId, address srcTokenOut, uint256 srcAmtOut) = _swapV3(
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
            _celerSwap(swapInfo, message, srcTokenOut, srcAmtOut, chainId, nonce);
        } else {
            uint256 _maxSwap = maxRubicSwap; //SLOAD
            if (srcAmtOut > _maxSwap) {
                // split celer and Rubic
                uint256 cBridgePart = srcAmtOut - _maxSwap;

                _celerSwap(swapInfo, message, srcTokenOut, cBridgePart, chainId, nonce);
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
    function _swapV3(
        uint256 _amountIn,
        uint64 _dstChainId,
        SwapInfoV3 memory _srcSwap
    )
        private
        returns (
            uint64,
            address,
            uint256
        )
    {
        nonce += 1;
        uint64 chainId = uint64(block.chainid);

        require(_srcSwap.path.length > 20 && _dstChainId != chainId, 'empty src swap path or same chain id');

        address srcTokenOut = address(_getLastBytes20(_srcSwap.path));

        (bool success, uint srcAmtOut) = _trySwapV3(_srcSwap, _amountIn);
        if (!success) revert('src swap failed');

        require(
            srcAmtOut >= minSwapAmount[address(_getLastBytes20(_srcSwap.path))],
            'amount must be greater than min swap amount'
        );

        return (chainId, srcTokenOut, srcAmtOut);
    }

    function _celerSwap(
        SplitSwapInfoV3 memory swapInfo,
        bytes memory message,
        address srcTokenOut,
        uint256 srcAmtOut,
        uint64 _chainId,
        uint64 _nonce
    ) private {
        require(swapInfo._dstSwap.path.length > 0 || swapInfo._dstSwap.dataInchOrPathV3.length == 0, 'empty dst swap path');

        bytes32 id = _computeSwapRequestId(msg.sender, _chainId, swapInfo._dstChainId, message);

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

        emit SwapRequestSentV3(id, swapInfo._dstChainId, swapInfo._amountIn, address(_getFirstBytes20(swapInfo._srcSwap.path)));
    }

    function _trySwapV3(SwapInfoV3 memory _swap, uint256 _amount) internal returns (bool ok, uint256 amountOut) {
        if (!supportedDEXes.contains(_swap.dex)) {
            return (false, 0);
        }

        IERC20(address(_getFirstBytes20(_swap.path))).safeIncreaseAllowance(_swap.dex, _amount);

        IUniswapRouterV3.ExactInputParams memory paramsV3 = IUniswapRouterV3.ExactInputParams(
            _swap.path,
            address(this),
            _swap.deadline,
            _amount,
            _swap.amountOutMinimum
        );

        try IUniswapRouterV3(_swap.dex).exactInput(paramsV3) returns (uint256 _amountOut) {
            return (true, _amountOut);
        } catch {
            return (false, 0);
        }
    }
}
