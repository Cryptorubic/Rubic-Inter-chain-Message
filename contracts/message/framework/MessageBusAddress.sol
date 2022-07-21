// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

abstract contract MessageBusAddress { // TODO REFACTOR !!!
    event MessageBusUpdated(address messageBus);

    address public messageBus;
}
