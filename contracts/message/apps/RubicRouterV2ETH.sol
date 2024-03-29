//// SPDX-License-Identifier: MIT
//
//pragma solidity >=0.8.9;
//
//import './TransferSwapV2.sol';
//import './TransferSwapV3.sol';
//import './TransferSwapInch.sol';
//import './BridgeSwap.sol';
//
//
//contract RubicRouterV2ETH is TransferSwapV2, TransferSwapV3, TransferSwapInch, BridgeSwap {
//    using SafeERC20Upgradeable for IERC20Upgradeable;
//    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
//
//    event CrossChainProcessed(bytes32 id, uint256 dstAmount, SwapStatus status);
//
//    /// @dev This modifier prevents using executor functions
//    modifier onlyExecutor(address _executor) {
//        require(hasRole(EXECUTOR_ROLE, _executor), 'SwapBase: caller is not an executor');
//        _;
//    }
//
//    constructor(
//        uint256[] memory _blockchainIDs,
//        uint256[] memory _cryptoFees,
//        uint256[] memory _platformFees,
//        address[] memory _tokens,
//        uint256[] memory _minTokenAmounts,
//        uint256[] memory _maxTokenAmounts,
//        address[] memory _routers,
//        address _executor,
//        address _messageBus,
//        address _nativeWrap
//    ) {
//        initialize(
//            _blockchainIDs,
//            _cryptoFees,
//            _platformFees,
//            _tokens,
//            _minTokenAmounts,
//            _maxTokenAmounts,
//            _routers
//        );
//
//        nativeWrap = _nativeWrap;
//        messageBus = _messageBus;
//        _setupRole(EXECUTOR_ROLE, _executor);
//    }
//
//    function initialize(
//        uint256[] memory _blockchainIDs,
//        uint256[] memory _cryptoFees,
//        uint256[] memory _platformFees,
//        address[] memory _tokens,
//        uint256[] memory _minTokenAmounts,
//        uint256[] memory _maxTokenAmounts,
//        address[] memory _routers
//    ) private initializer {
//        __MultipleTransitTokenInit(
//            _blockchainIDs,
//            _cryptoFees,
//            _platformFees,
//            _tokens,
//            _minTokenAmounts,
//            _maxTokenAmounts,
//            _routers
//        );
//    }
//
//    /**
//     * @notice called by MessageBus when the tokens are checked to be arrived at this contract's address.
//               sends the amount received to the receiver. swaps beforehand if swap behavior is defined in message
//     * NOTE: if the swap fails, it sends the tokens received directly to the receiver as fallback behavior
//     * @param _token the address of the token sent through the bridge
//     * @param _amount the amount of tokens received at this contract through the cross-chain bridge
//     * @param _srcChainId source chain ID
//     * @param _message SwapRequestV2 message that defines the swap behavior on this destination chain
//     */
//    function executeMessageWithTransfer(
//        address,
//        address _token,
//        uint256 _amount,
//        uint64 _srcChainId,
//        bytes calldata _message,
//        address _executor
//    )
//        external
//        payable
//        override
//        onlyMessageBus
//        nonReentrant
//        whenNotPaused
//        onlyExecutor(_executor)
//        returns (ExecutionStatus)
//    {
//        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));
//        bytes32 id = _computeSwapRequestId(m.receiver, _srcChainId, uint64(block.chainid), _message);
//
//        if (_token == nativeWrap) {
//            IWETH(nativeWrap).deposit{value: _amount}();
//        }
//
//        _amount = calculateFee(m.swap.integrator, _amount, uint256(_srcChainId), _token);
//
//        if (m.swap.version == SwapVersion.v3) {
//            _executeDstSwapV3(_token, _amount, id, m);
//        } else if (m.swap.version == SwapVersion.bridge) {
//            _executeDstBridge(_token, _amount, id, m);
//        } else {
//            _executeDstSwapV2(_token, _amount, id, m);
//        }
//
//        // always return true since swap failure is already handled in-place
//        return ExecutionStatus.Success;
//    }
//
//    /**
//     * @notice called by MessageBus when the executeMessageWithTransfer call fails. does nothing but emitting a "fail" event
//     * @param _srcChainId source chain ID
//     * @param _message SwapRequest message that defines the swap behavior on this destination chain
//     * execution on dst chain
//     */
//    function executeMessageWithTransferFallback(
//        address, // _sender
//        address _token,
//        uint256 _amount,
//        uint64 _srcChainId,
//        bytes calldata _message,
//        address _executor
//    ) external payable override onlyMessageBus nonReentrant onlyExecutor(_executor) returns (ExecutionStatus) {
//        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));
//
//        bytes32 id = _computeSwapRequestId(m.receiver, _srcChainId, uint64(block.chainid), _message);
//
//        if (_token == nativeWrap) {
//            IWETH(nativeWrap).deposit{value: _amount}();
//        }
//
//        // Failed status means user hasn't received funds
//        SwapStatus status = SwapStatus.Failed;
//        processedTransactions[id] = status;
//        emit CrossChainProcessed(id, _amount, status);
//        // always return Fail to mark this transfer as failed since if this function is called then there nothing more
//        // we can do in this app as the swap failures are already handled in executeMessageWithTransfer
//        return ExecutionStatus.Fail;
//    }
//
//    // called on source chain for handling of bridge failures (bad liquidity, bad slippage, etc...)
//    function executeMessageWithTransferRefund(
//        address _token,
//        uint256 _amount,
//        bytes calldata _message,
//        address _executor
//    )
//        external
//        payable
//        override
//        onlyMessageBus
//        nonReentrant
//        whenNotPaused
//        onlyExecutor(_executor)
//        returns (ExecutionStatus)
//    {
//        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));
//
//        bytes32 id = _computeSwapRequestId(m.receiver, uint64(block.chainid), m.dstChainId, _message);
//
//        if (_token == nativeWrap) {
//            IWETH(nativeWrap).deposit{value: _amount}();
//        }
//
//        _sendToken(_token, _amount, m.receiver, m.swap.nativeOut);
//
//        SwapStatus status = SwapStatus.Fallback;
//        processedTransactions[id] = status;
//        emit CrossChainProcessed(id, _amount, status);
//
//        return ExecutionStatus.Success;
//    }
//
//    // no need to swap, directly send the bridged token to user
//    function _executeDstBridge(
//        address _token,
//        uint256 _amount,
//        bytes32 _id,
//        SwapRequestDest memory _msgDst
//    ) private {
//        require(
//            _token == _msgDst.swap.path[0],
//            'bridged token must be the same as the first token in destination swap path'
//        );
//        require(_msgDst.swap.path.length == 1, 'dst bridge expected');
//        _sendToken(_msgDst.swap.path[0], _amount, _msgDst.receiver, _msgDst.swap.nativeOut);
//
//        SwapStatus status;
//        status = SwapStatus.Succeeded;
//
//        processedTransactions[_id] = status;
//        emit CrossChainProcessed(_id, _amount, status);
//    }
//
//    function _executeDstSwapV2(
//        address _token,
//        uint256 _amount,
//        bytes32 _id,
//        SwapRequestDest memory _msgDst
//    ) private {
//        require(
//            _token == _msgDst.swap.path[0],
//            'bridged token must be the same as the first token in destination swap path'
//        );
//        require(_msgDst.swap.path.length > 1, 'dst swap expected');
//
//        uint256 dstAmount;
//        SwapStatus status;
//
//        SwapInfoV2 memory _dstSwap = SwapInfoV2({
//            dex: _msgDst.swap.dex,
//            path: _msgDst.swap.path,
//            deadline: _msgDst.swap.deadline,
//            amountOutMinimum: _msgDst.swap.amountOutMinimum
//        });
//
//        bool success;
//        (success, dstAmount) = _trySwapV2(_dstSwap, _amount);
//        if (success) {
//            _sendToken(_dstSwap.path[_dstSwap.path.length - 1], dstAmount, _msgDst.receiver, _msgDst.swap.nativeOut);
//            status = SwapStatus.Succeeded;
//            processedTransactions[_id] = status;
//        } else {
//            // handle swap failure, send the received token directly to receiver
//            _sendToken(_token, _amount, _msgDst.receiver, _msgDst.swap.nativeOut);
//            dstAmount = _amount;
//            status = SwapStatus.Fallback;
//            processedTransactions[_id] = status;
//        }
//
//        emit CrossChainProcessed(_id, dstAmount, status);
//    }
//
//    function _executeDstSwapV3(
//        address _token,
//        uint256 _amount,
//        bytes32 _id,
//        SwapRequestDest memory _msgDst
//    ) private {
//        require(
//            _token == address(_getFirstBytes20(_msgDst.swap.pathV3)),
//            'bridged token must be the same as the first token in destination swap path'
//        );
//        require(_msgDst.swap.pathV3.length > 20, 'dst swap expected');
//
//        uint256 dstAmount;
//        SwapStatus status;
//
//        SwapInfoV3 memory _dstSwap = SwapInfoV3({
//            dex: _msgDst.swap.dex,
//            path: _msgDst.swap.pathV3,
//            deadline: _msgDst.swap.deadline,
//            amountOutMinimum: _msgDst.swap.amountOutMinimum
//        });
//
//        bool success;
//        (success, dstAmount) = _trySwapV3(_dstSwap, _amount);
//        if (success) {
//            _sendToken(address(_getLastBytes20(_dstSwap.path)), dstAmount, _msgDst.receiver, _msgDst.swap.nativeOut);
//            status = SwapStatus.Succeeded;
//            processedTransactions[_id] = status;
//        } else {
//            // handle swap failure, send the received token directly to receiver
//            _sendToken(_token, _amount, _msgDst.receiver, _msgDst.swap.nativeOut);
//            dstAmount = _amount;
//            status = SwapStatus.Fallback;
//            processedTransactions[_id] = status;
//        }
//
//        emit CrossChainProcessed(_id, dstAmount, status);
//    }
//
//    function _sendToken(
//        address _token,
//        uint256 _amount,
//        address _receiver,
//        bool _nativeOut
//    ) private {
//        if (_token == nativeWrap && _nativeOut == true) {
//            IWETH(nativeWrap).withdraw(_amount);
//            (bool sent, ) = _receiver.call{value: _amount, gas: 50000}('');
//            require(sent, 'failed to send native');
//        } else {
//            IERC20Upgradeable(_token).safeTransfer(_receiver, _amount);
//        }
//    }
//
//    function sweepTokens(
//        address _token,
//        uint256 _amount,
//        bool _nativeOut
//    ) external onlyManagerOrAdmin {
//        _sendToken(_token, _amount, msg.sender, _nativeOut);
//    }
//
//    function manualRefund(
//        bytes32 _id,
//        address _token,
//        uint256 _amount,
//        address _to,
//        bool _nativeOut
//    ) external nonReentrant {
//        require(
//            hasRole(MANAGER_ROLE, msg.sender) || hasRole(EXECUTOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
//        );
//        require(processedTransactions[_id] != SwapStatus.Succeeded && processedTransactions[_id] != SwapStatus.Fallback);
//        _sendToken(_token, _amount, _to, _nativeOut);
//        processedTransactions[_id] = SwapStatus.Fallback;
//    }
//
//    function setNativeWrap(address _nativeWrap) external onlyManagerOrAdmin {
//        nativeWrap = _nativeWrap;
//    }
//
//    function setMessageBus(address _messageBus) public onlyManagerOrAdmin {
//        messageBus = _messageBus;
//        emit MessageBusUpdated(messageBus);
//    }
//}
