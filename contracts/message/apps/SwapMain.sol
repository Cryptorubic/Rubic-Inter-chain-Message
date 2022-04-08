// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

import './TransferSwapV2.sol';
import './TransferSwapV3.sol';
import './TransferSwapInch.sol';
import './BridgeSwap.sol';

contract SwapMain is TransferSwapV2, TransferSwapV3, TransferSwapInch, BridgeSwap {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    event CelerSwapDone(bytes32 id, uint256 dstAmount, SwapStatus status);
    event RubicSwapDone(bytes32 id, uint256 dstAmount, SwapStatus status);

    constructor(
        address _messageBus,
        address[] memory _supportedDEXes,
        address _nativeWrap,
        address _rubicTransit,
        uint256 _maxRubicSwap
    ) SwapBase(_nativeWrap, _rubicTransit, _maxRubicSwap) {
        messageBus = _messageBus;
        for (uint256 i = 0; i < _supportedDEXes.length; i++) {
            supportedDEXes.add(_supportedDEXes[i]);
        }
        dstCryptoFee[5] = 10000000; //TODO: remove
        feeRubic = 1600; // 0.16%
    }

    /**
     * @notice called by MessageBus when the tokens are checked to be arrived at this contract's address.
               sends the amount received to the receiver. swaps beforehand if swap behavior is defined in message
     * NOTE: if the swap fails, it sends the tokens received directly to the receiver as fallback behavior
     * @param _token the address of the token sent through the bridge
     * @param _amount the amount of tokens received at this contract through the cross-chain bridge
     * @param _srcChainId source chain ID
     * @param _message SwapRequestV2 message that defines the swap behavior on this destination chain
     */
    function executeMessageWithTransfer(
        address,
        address _token,
        uint256 _amount,
        uint64 _srcChainId,
        bytes memory _message,
        address
    ) external payable override onlyRelayerOrMessageBus returns (ExecutionStatus) {
        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));
        bytes32 id = _computeSwapRequestId(m.receiver, _srcChainId, uint64(block.chainid), _message);

        uint256 dstAmount = _amount;
        SwapStatus status;

        if (m.swap.version == SwapVersion.v3) {
            (dstAmount, status) = _executeDstSwapV3(_token, _amount, m);
        }
        else if (m.swap.version == SwapVersion.bridge) {
            _executeDstBridge(_token, _amount, m);
            status = SwapStatus.Succeeded;
        }
        else if (m.swap.version == SwapVersion.v2) {
            (dstAmount, status) = _executeDstSwapV2(_token, _amount, m);
        } else {
            (dstAmount, status) = _executeDstSwapInch(_token, _amount, m);
        }

        if (msg.sender == messageBus) {
            emit CelerSwapDone(id, dstAmount, status);
        } else {
            require(_amount <= maxRubicSwap, 'too much transit token requested');
            emit RubicSwapDone(id, dstAmount, status);
        }
        // always return true since swap failure is already handled in-place
        return ExecutionStatus.Success;
    }

    /**
     * @notice called by MessageBus when the executeMessageWithTransfer call fails. does nothing but emitting a "fail" event
     * @param _srcChainId source chain ID
     * @param _message SwapRequestDest message that defines the swap behavior on this destination chain
     */
    function executeMessageWithTransferFallback(
        address, // _sender (executor)
        address _token,
        uint256 _amount,
        uint64 _srcChainId,
        bytes memory _message,
        address
    ) external payable override onlyRelayerOrMessageBus returns (ExecutionStatus) {
        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));

        bytes32 id = _computeSwapRequestId(m.receiver, _srcChainId, uint64(block.chainid), _message);
        if (m.swap.version == SwapVersion.v3) {
            _sendToken(_token, _amount, m.receiver, m.nativeOut);
        } else {
            _sendToken(_token, _amount, m.receiver, m.nativeOut);
        }
        emit CelerSwapDone(id, 0, SwapStatus.Failed);
        // always return false to mark this transfer as failed since if this function is called then there nothing more
        // we can do in this app as the swap failures are already handled in executeMessageWithTransfer
        return ExecutionStatus.Fail;
    }

    function executeMessageWithTransferRefund(
        address _token,
        uint256 _amount,
        bytes calldata _message,
        address
    ) external payable override onlyRelayerOrMessageBus returns (ExecutionStatus) {
        SwapRequestDest memory m = abi.decode((_message), (SwapRequestDest));
        if (m.swap.version == SwapVersion.v3) {
            _sendToken(_token, _amount, m.receiver, m.nativeOut);
        } else {
            _sendToken(m.swap.path[m.swap.path.length - 1], _amount, m.receiver, m.nativeOut);
        }
        return ExecutionStatus.Success;
    }

    function _executeDstSwapInch(
        address _token,
        uint256 _amount,
        SwapRequestDest memory _msgDst
    ) private returns (uint256 dstAmount, SwapStatus status) {
        require(
            _token == _msgDst.swap.path[0],
            'bridged token must be the same as the first token in destination swap path'
        );
        require(_msgDst.swap.path.length > 1, 'dst swap expected');

        SwapInfoInch memory _dstSwap = SwapInfoInch({
            dex: _msgDst.swap.dex,
            path: _msgDst.swap.path,
            data: _msgDst.swap.dataInchOrPathV3,
            amountOutMinimum: _msgDst.swap.amountOutMinimum
        });

        bool success;
        if (_dstSwap.path[0] == nativeWrap) {
            (success, dstAmount) = _trySwapNativeInch(_dstSwap, _amount);
        } else {
            (success, dstAmount) = _trySwapInch(_dstSwap, _amount);
        }

        if (success) {
            _sendToken(_dstSwap.path[_dstSwap.path.length - 1], dstAmount, _msgDst.receiver, _msgDst.nativeOut);
            status = SwapStatus.Succeeded;
        } else {
            // handle swap failure, send the received token directly to receiver
            _sendToken(_token, _amount, _msgDst.receiver, false);
            dstAmount = _amount;
            status = SwapStatus.Fallback;
        }
    }

    // no need to swap, directly send the bridged token to user
    function _executeDstBridge(
        address _token,
        uint256 _amount,
        SwapRequestDest memory _msgDst
    ) private {
        require(
            _token == _msgDst.swap.path[0],
            'bridged token must be the same as the first token in destination swap path'
        );
        require(_msgDst.swap.path.length == 1, 'dst bridge expected');
        _sendToken(_msgDst.swap.path[0], _amount, _msgDst.receiver, _msgDst.nativeOut);
    }

    function _executeDstSwapV2(
        address _token,
        uint256 _amount,
        SwapRequestDest memory _msgDst
    ) private returns (uint256 dstAmount, SwapStatus status){
        // TODO add as modifier
        require(
            _token == _msgDst.swap.path[0],
            'bridged token must be the same as the first token in destination swap path'
        );
        // TODO add as modifier
        require(_msgDst.swap.path.length > 1, 'dst swap expected');

        SwapInfoV2 memory _dstSwap = SwapInfoV2({
            dex: _msgDst.swap.dex,
            path: _msgDst.swap.path,
            deadline: _msgDst.swap.deadline,
            amountOutMinimum: _msgDst.swap.amountOutMinimum
        });

        bool success;
        (success, dstAmount) = _trySwapV2(_dstSwap, _amount);
        if (success) {
            _sendToken(_dstSwap.path[_dstSwap.path.length - 1], dstAmount, _msgDst.receiver, _msgDst.nativeOut);
            status = SwapStatus.Succeeded;
        } else {
            // handle swap failure, send the received token directly to receiver
            _sendToken(_token, _amount, _msgDst.receiver, false);
            dstAmount = _amount;
            status = SwapStatus.Fallback;
        }

        status = SwapStatus.Succeeded;
    }

    function _executeDstSwapV3(
        address _token,
        uint256 _amount,
        SwapRequestDest memory _msgDst
    ) private returns (uint256 dstAmount, SwapStatus status) {
        require(
            _token == address(_getFirstBytes20(_msgDst.swap.dataInchOrPathV3)),
            'bridged token must be the same as the first token in destination swap path'
        );
        require(_msgDst.swap.dataInchOrPathV3.length > 20, 'dst swap expected');

        SwapInfoV3 memory _dstSwap = SwapInfoV3({
            dex: _msgDst.swap.dex,
            path: _msgDst.swap.dataInchOrPathV3,
            deadline: _msgDst.swap.deadline,
            amountOutMinimum: _msgDst.swap.amountOutMinimum
        });

        bool success;
        (success, dstAmount) = _trySwapV3(_dstSwap, _amount);
        if (success) {
            _sendToken(address(_getLastBytes20(_dstSwap.path)), dstAmount, _msgDst.receiver, _msgDst.nativeOut);
            status = SwapStatus.Succeeded;
        } else {
            // handle swap failure, send the received token directly to receiver
            _sendToken(_token, _amount, _msgDst.receiver, false);
            dstAmount = _amount;
            status = SwapStatus.Fallback;
        }
    }

    function _sendToken(
        address _token,
        uint256 _amount,
        address _receiver,
        bool _nativeOut
    ) private {
        if (_nativeOut) {
            require(_token == nativeWrap, 'token mismatch');
            IWETH(nativeWrap).withdraw(_amount);
            (bool sent, ) = _receiver.call{value: _amount, gas: 50000}('');
            require(sent, 'failed to send native');
        } else {
            IERC20(_token).safeTransfer(_receiver, _amount);
        }
    }

    // returns an array of the supported DEXes
    function getSupportedDEXes() external view returns (address[] memory) {
        return supportedDEXes.values();
    }

    function addSupportedDEX(address _dex) external onlyOwner {
        supportedDEXes.add(_dex);
    }

    function removeSupportedDEX(address _dex) external onlyOwner {
        supportedDEXes.remove(_dex);
    }

    // sets the maximum swap amount going through Rubic bridge
    function setMaxRubicSwap(uint _amount) external onlyOwner {
        maxRubicSwap = _amount;
    }

    // TODO: switch to AccessControl
    function setRubicRelayer(address _relayer) external onlyOwner {
        RubicRelayer = _relayer;
    }

    function setRubicFee(uint256 _feeRubic) external onlyOwner {
        require(_feeRubic < 5000000);
        feeRubic = _feeRubic;
    }

    function setCryptoFee(uint64 _networkID, uint256 _amount) external onlyOwner {
        dstCryptoFee[_networkID] = _amount;
    }

    /*
    function setSupportedDex(address _dex, bool _enabled) external onlyOwner {
        supportedDex[_dex] = _enabled;
    }*/

    function sweepTokens(IERC20 token) external onlyOwner { // TODO: decentralization
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }

    function collectFee(address _token, uint256 _amount) external onlyOwner {
        require(collectedFee[_token] <= _amount, 'not enough collected fee');
        if (_token == nativeWrap) {
            IWETH(nativeWrap).withdraw(_amount);
            (bool sent, ) = payable(msg.sender).call{value: _amount, gas: 50000}('');
            require(sent, 'failed to send native');
        } else {
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
        collectedFee[_token] -= _amount;
    }
}
