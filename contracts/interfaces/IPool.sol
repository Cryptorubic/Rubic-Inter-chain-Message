// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

interface IPool { // TODO USELESS?
    function addLiquidity(address _token, uint256 _amount) external;

    function withdraws(bytes32 withdrawId) external view returns (bool);

    function withdraw(
        bytes calldata _wdmsg,
        bytes[] calldata _sigs,
        address[] calldata _signers,
        uint256[] calldata _powers
    ) external;
}
