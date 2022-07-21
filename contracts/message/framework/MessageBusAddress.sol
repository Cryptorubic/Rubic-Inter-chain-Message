// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

abstract contract MessageBusAddress {
    event MessageBusUpdated(address messageBus);

    address public messageBus;
}
