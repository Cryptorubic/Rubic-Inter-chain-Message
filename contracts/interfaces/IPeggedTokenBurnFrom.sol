// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

// used for pegged token with openzeppelin ERC20Burnable interface
// only compatible with PeggedTokenBridgeV2
interface IPeggedTokenBurnFrom { // TODO USELESS?
    function mint(address _to, uint256 _amount) external;

    function burnFrom(address _from, uint256 _amount) external;
}
