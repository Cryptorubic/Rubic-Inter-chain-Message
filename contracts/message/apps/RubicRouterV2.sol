// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import './TransferSwapV2.sol';
import './TransferSwapV3.sol';
import './TransferSwapInch.sol';
import './BridgeSwap.sol';

contract RubicRouterV2 is TransferSwapV2, TransferSwapV3, TransferSwapInch, BridgeSwap {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    event SwapRequestDone(bytes32 id, uint256 dstAmount, SwapStatus status); // TODO add params

    /// @dev This modifier prevents using executor functions
    modifier onlyExecutor(address _executor) { // TODO remove to relayer
        require(hasRole(EXECUTOR_ROLE, _executor), 'SwapBase: caller not an executor');
        _;
    }

    constructor(
        uint256 _fixedCryptoFee,
        address[] memory _routers,
        address[] memory _tokens,
        uint256[] memory _minTokenAmounts,
        uint256[] memory _maxTokenAmounts,
        uint256[] memory _blockchainIDs,
        uint256[] memory _blockchainToGasFee,
        uint256[] memory _blockchainToRubicPlatformFee,
        address _executor,
        address _messageBus,
        address _nativeWrap
    ) {
        initialize(
            _fixedCryptoFee,
            _routers,
            _tokens,
            _minTokenAmounts,
            _maxTokenAmounts,
            _blockchainIDs,
            _blockchainToGasFee,
            _blockchainToRubicPlatformFee
        );

        nativeWrap = _nativeWrap;
        messageBus = _messageBus;
        _setupRole(EXECUTOR_ROLE, _executor);
    }

    function initialize(
        uint256 _fixedCryptoFee,
        address[] memory _routers,
        address[] memory _tokens,
        uint256[] memory _minTokenAmounts,
        uint256[] memory _maxTokenAmounts,
        uint256[] memory _blockchainIDs,
        uint256[] memory _blockchainToGasFee,
        uint256[] memory _blockchainToRubicPlatformFee
    ) private initializer {
        __WithDestinationFunctionalityInit(
            _fixedCryptoFee,
            _routers,
            _tokens,
            _minTokenAmounts,
            _maxTokenAmounts,
            _blockchainIDs,
            _blockchainToGasFee,
            _blockchainToRubicPlatformFee
        );
    }

    /**
     * @notice called by MessageBus when the tokens are checked to be arrived at this contract's address.
               sends the amount received to the receiver. swaps beforehand if swap behavior is defined in message
     * NOTE: if the swap fails, it sends the tokens received directly to the receiver as fallback behavior
     * @param _token the address of the token sent through the bridge
     * @param _amount the amount of tokens received at this contract through the cross-chain bridge
     * @param _srcChainId source chain ID
     * @param _message SwapRequestDst message that defines the swap behavior on this destination chain
     */
    function executeMessageWithTransfer(
        address,
        address _token,
        uint256 _amount,
        uint64 _srcChainId,
        bytes calldata _message,
        address _executor
    )
        external
        payable
        override
        onlyMessageBus
        nonReentrant
        whenNotPaused
        onlyExecutor(_executor)
        returns (ExecutionStatus)
    {
        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));
        bytes32 id = _computeSwapRequestId(m.receiver, _srcChainId, uint64(block.chainid), _message);

        _amount = accrueTokenFees(
            m.swap.integrator,
            integratorToFeeInfo[m.swap.integrator],
            _amount,
            uint256(_srcChainId),
            _token
        );

        address _outputToken = _retrieveDstTokenAddress(m.swap);

        if (m.swap.version == SwapVersion.v3) {
            _executeDstSwapV3(_token, _outputToken, _amount, id, m);
        } else if (m.swap.version == SwapVersion.bridge) {
            _executeDstBridge(_token, _amount, id, m);
        } else {
            _executeDstSwapV2(_token, _outputToken, _amount, id, m);
        }

        // always return true since swap failure is already handled in-place
        return ExecutionStatus.Success;
    }

    function _afterTargetProcessing(bytes32 _id, uint256 _amount, SwapStatus _status) private {
        processedTransactions[_id] = _status;
        emit SwapRequestDone(_id, _params, _status); // TODO blockchain parapms struct
    }

    /**
     * @notice called by MessageBus when the executeMessageWithTransfer call fails. does nothing but emitting a "fail" event
     * @param _srcChainId source chain ID
     * @param _message SwapRequest message that defines the swap behavior on this destination chain
     * execution on dst chain
     */
    function executeMessageWithTransferFallback(
        address, // _sender
        address, // _token
        uint256 _amount,
        uint64 _srcChainId,
        bytes calldata _message,
        address _executor
    ) external payable override onlyMessageBus nonReentrant onlyExecutor(_executor) returns (ExecutionStatus) {
        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));

        bytes32 id = _computeSwapRequestId(m.receiver, _srcChainId, uint64(block.chainid), _message);

        // Failed status means user hasn't received funds
        _afterTargetProcessing(id, _amount, SwapStatus.Failed);
        // always return Fail to mark this transfer as failed since if this function is called then there nothing more
        // we can do in this app as the swap failures are already handled in executeMessageWithTransfer
        return ExecutionStatus.Fail;
    }

    // called on source chain for handling of bridge failures (bad liquidity, bad slippage, etc...)
    function executeMessageWithTransferRefund(
        address _token,
        uint256 _amount,
        bytes calldata _message,
        address _executor
    )
        external
        payable
        override
        onlyMessageBus
        nonReentrant
        whenNotPaused
        onlyExecutor(_executor)
        returns (ExecutionStatus)
    {
        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));

        bytes32 id = _computeSwapRequestId(m.receiver, uint64(block.chainid), m.dstChainId, _message);

        _sendToken(_token, _amount, m.receiver, m.swap.nativeOut);

        _afterTargetProcessing(id, _amount, SwapStatus.Fallback);

        return ExecutionStatus.Success;
    }

    // no need to swap, directly send the bridged token to user
    function _executeDstBridge(
        address _inputToken,
        uint256 _amount,
        bytes32 _id,
        SwapRequestDest memory _msgDst
    ) private {
        require(
            _inputToken == _msgDst.swap.path[0], //TODO: strange require
            'first token must be the target'
        );
        require(_msgDst.swap.path.length == 1, 'dst bridge expected');

        _sendToken(_inputToken, _amount, _msgDst.receiver, _msgDst.swap.nativeOut);

        _afterTargetProcessing(_id, _amount, SwapStatus.Succeeded);
    }

    function _executeDstSwapV2(
        address _inputToken,
        address _outputToken,
        uint256 _amount,
        bytes32 _id,
        SwapRequestDest memory _msgDst
    ) private {
        require(
            _inputToken == _msgDst.swap.path[0],
            'first token must be transit'
        );

        SwapInfoV2 memory _dstSwap = SwapInfoV2({
            dex: _msgDst.swap.dex,
            path: _msgDst.swap.path,
            deadline: _msgDst.swap.deadline,
            amountOutMinimum: _msgDst.swap.amountOutMinimum
        });

        (bool success, uint256 dstAmount) = _trySwapV2(_dstSwap, _amount);
        if (success) {
            _sendToken(_outputToken, dstAmount, _msgDst.receiver, _msgDst.swap.nativeOut);
            _afterTargetProcessing(_id, dstAmount, SwapStatus.Succeeded);
        } else {
            // handle swap failure, send the received token directly to receiver
            _sendToken(_inputToken, _amount, _msgDst.receiver, _msgDst.swap.nativeOut);
            _afterTargetProcessing(_id, _amount, SwapStatus.Fallback);
        }
    }

    function _executeDstSwapV3(
        address _inputToken,
        address _outputToken,
        uint256 _amount,
        bytes32 _id,
        SwapRequestDest memory _msgDst
    ) private {
        require(
            _inputToken == address(_getFirstBytes20(_msgDst.swap.pathV3)),
            'first token must be transit'
        );

        SwapInfoV3 memory _dstSwap = SwapInfoV3({
            dex: _msgDst.swap.dex,
            path: _msgDst.swap.pathV3,
            deadline: _msgDst.swap.deadline,
            amountOutMinimum: _msgDst.swap.amountOutMinimum
        });

        (bool success, uint256 dstAmount) = _trySwapV3(_dstSwap, _amount);
        if (success) {
            _sendToken(_outputToken, dstAmount, _msgDst.receiver, _msgDst.swap.nativeOut);
            _afterTargetProcessing(_id, dstAmount, SwapStatus.Succeeded);
        } else {
            // handle swap failure, send the received token directly to receiver
            _sendToken(_inputToken, _amount, _msgDst.receiver, _msgDst.swap.nativeOut);
            _afterTargetProcessing(_id, _amount, SwapStatus.Fallback);
        }
    }

    function _sendToken(
        address _token,
        uint256 _amount,
        address _receiver,
        bool _nativeOut
    ) private {
        if (_token == nativeWrap && _nativeOut == true) {
            IWETH(nativeWrap).withdraw(_amount);
            sendToken(address(0), _amount, _receiver);
        } else {
            sendToken(_token, _amount, _receiver);
        }
    }

    function sweepTokens(
        address _token,
        uint256 _amount
    ) external onlyManagerOrAdmin { // TODO only admin
        sendToken(_token, _amount, msg.sender);
    }

    function manualRefund(
        bytes32 _id,
        address _token,
        uint256 _amount,
        address _to,
        bool _nativeOut
    ) external nonReentrant onlyManagerOrAdmin { // TODO amount from id + fee
        SwapStatus _status = processedTransactions[_id];
        require(_status != SwapStatus.Succeeded && _status != SwapStatus.Fallback);

        _sendToken(_token, _amount, _to, _nativeOut);
        processedTransactions[_id] = SwapStatus.Fallback;
    }

    function setNativeWrap(address _nativeWrap) external onlyManagerOrAdmin {
        nativeWrap = _nativeWrap;
    }

    function setMessageBus(address _messageBus) public onlyManagerOrAdmin {
        messageBus = _messageBus;
        emit MessageBusUpdated(messageBus);
    }
}
