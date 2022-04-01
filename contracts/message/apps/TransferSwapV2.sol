// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import "./SwapBase.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

abstract contract TransferSwapV2 is SwapBase {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    event SwapRequestSentV2(
        bytes32 id,
        uint64 dstChainId,
        uint256 srcAmount,
        address srcToken
    );

    // emitted if the recipient should receive crypto in the target blockchain
    event TransferCryptoToOtherBlockchainUser(
        uint256 transitAmountIn,
        uint256 amountSpent
    );
    
    // emitted if the recipient should receive tokens in the target blockchain
    event TransferTokensToOtherBlockchainUser(
        uint256 transitAmountIn,
        uint256 amountSpent
    );

    function transferWithSwapV2Native(
        address _receiver,
        uint256 _amountIn,
        uint256 _cBridgePart,
        uint64 _dstChainId,
        SwapInfoV2 calldata _srcSwap,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut
    ) external payable onlyEOA {
        require(_srcSwap.path[0] == nativeWrap, "token mismatch");
        require(msg.value >= _amountIn, "Amount insufficient");
        IWETH(nativeWrap).deposit{value: _amountIn}();

        _splitTransferWithSwapV2(
            _receiver,
            _amountIn,
            _cBridgePart,
            _dstChainId,
            _srcSwap,
            _dstSwap,
            _maxBridgeSlippage,
            _nativeOut
        );
    }

    function transferWithSwapV2(
        address _receiver,
        uint256 _amountIn,
        uint256 _cBridgePart,
        uint64 _dstChainId,
        SwapInfoV2 calldata _srcSwap,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut
    ) external payable onlyEOA {
        IERC20(_srcSwap.path[0]).safeTransferFrom(
            msg.sender,
            address(this),
            _amountIn
        );

        _splitTransferWithSwapV2(
            _receiver,
            _amountIn,
            _cBridgePart,
            _dstChainId,
            _srcSwap,
            _dstSwap,
            _maxBridgeSlippage,
            _nativeOut
        );
    }

    function _splitTransferWithSwapV2(
        address _receiver,
        uint256 _amountIn,
        uint256 _cBridgePart,
        uint64 _dstChainId,
        SwapInfoV2 calldata _srcSwap,
        SwapInfoDest calldata _dstSwap,
        uint32 _maxBridgeSlippage,
        bool _nativeOut
    ) private {
        (uint64 chainId, address srcTokenOut, uint256 srcAmtIn, uint256 srcAmtOut) = _swapV2(
            _amountIn,
            _dstChainId,
            _srcSwap
        );

        if (_cBridgePart == 1e6){
            _crossChainTransferWithSwapV2(
                _receiver,
                _amountIn,
                chainId,
                _dstChainId,
                _srcSwap,
                _dstSwap,
                _maxBridgeSlippage,
                nonce,
                _nativeOut,
                msg.value,
                srcTokenOut,
                srcAmtOut
            );
        } else if (_cBridgePart == 0){
            _afterRubicSwap(
                srcTokenOut,
                srcAmtIn,
                srcAmtOut,
                _nativeOut
            );
        } else {
            uint256 _cBridgeAmount = srcAmtOut * _cBridgePart / 1e6;

            _crossChainTransferWithSwapV2(
                _receiver,
                _amountIn,
                chainId,
                _dstChainId,
                _srcSwap,
                _dstSwap,
                _maxBridgeSlippage,
                nonce,
                _nativeOut,
                msg.value,
                srcTokenOut,
                _cBridgeAmount
            );

            _afterRubicSwap(
                srcTokenOut,
                srcAmtIn - _cBridgeAmount,
                srcAmtOut,
                _nativeOut
            );
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
    ) private returns (uint64, address, uint256, uint256){
        nonce += 1;
        uint64 chainId = uint64(block.chainid);

        require(
            _srcSwap.path.length > 1 && _dstChainId != chainId,
            "empty src swap path or same chain id"
        );

        address srcTokenOut = _srcSwap.path[_srcSwap.path.length - 1];
        uint256 srcAmtOut = _amountIn;
        uint256 srcAmtSpent = _amountIn;

        // swap source token for intermediate token on the source DEX
        if (_srcSwap.path.length > 1) {
            bool success;
            (success, srcAmtSpent, srcAmtOut) = _trySwapV2(_srcSwap, _amountIn);
            if (!success) revert("src swap failed");
        }

        require(
            srcAmtOut >= minSwapAmount[_srcSwap.path[_srcSwap.path.length - 1]],
            "amount must be greater than min swap amount"
        );

        return (chainId, srcTokenOut, srcAmtSpent, srcAmtOut);
    }

    function _crossChainTransferWithSwapV2(
        address _receiver,
        uint256 _amountIn,
        uint64 _chainId,
        uint64 _dstChainId,
        SwapInfoV2 memory _srcSwap,
        SwapInfoDest memory _dstSwap,
        uint32 _maxBridgeSlippage,
        uint64 _nonce,
        bool _nativeOut,
        uint256 _fee,
        address srcTokenOut,
        uint256 srcAmtOut
    ) private {
        require(_dstSwap.path.length > 0, "empty dst swap path");
        bytes memory message = abi.encode(
            SwapRequestDest({
                swap: _dstSwap,
                receiver: msg.sender,
                nonce: _nonce,
                nativeOut: _nativeOut
            })
        );


        bytes32 id = SwapBase._computeSwapRequestId(
            msg.sender,
            _chainId,
            _dstChainId,
            message
        );
        _fee = _calculateCryptoFee(_fee, _dstChainId);

        sendMessageWithTransfer(
            _receiver,
            srcTokenOut,
            srcAmtOut,
            _dstChainId,
            _nonce,
            _maxBridgeSlippage,
            message,
            MsgDataTypes.BridgeSendType.Liquidity,
            _fee
        );
        emit SwapRequestSentV2(id, _dstChainId, _amountIn, _srcSwap.path[0]);
    }

    function _trySwapV2(SwapInfoV2 memory _swap, uint256 _amount)
        internal
        returns (bool ok, uint256 amountSpent, uint256 amountOut)
    {
        uint256 zero;

        if (!supportedDEXes.contains(_swap.dex)) {
            return (false, zero, zero);
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
            return (true, amounts[0], amounts[amounts.length - 1]);
        } catch {
            return (false, zero, zero);
        }
    }

    function _afterRubicSwap(
        address srcTokenOut,
        uint256 srcAmtIn,
        uint256 srcAmtOut,
        bool _nativeOut
    ) private {
        require(srcTokenOut == rubicTransit, 'wrong transit token');

        if (_nativeOut){
            emit TransferCryptoToOtherBlockchainUser(
                srcAmtOut,
                srcAmtIn
            );
        } else {
            emit TransferTokensToOtherBlockchainUser(
                srcAmtOut,
                srcAmtIn
            );
        }
    }
}
