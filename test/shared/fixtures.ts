import { Fixture } from 'ethereum-waffle';
import { ethers, network } from 'hardhat';
import { TestERC20 } from '../../typechain';
import { RubicRouterV2 } from '../../typechain';
import { WETH9 } from '../../typechain';
import { TestMessages } from '../../typechain';
import { MessageBusSender } from '../../typechain';
import TokenJSON from '../../artifacts/contracts/test/TestERC20.sol/TestERC20.json';
import WETHJSON from '../../artifacts/contracts/test/WETH9.sol/WETH9.json';
import MessageBusJSON from '../../artifacts/contracts/test/MessageBusSender.sol/MessageBusSender.json';
import { expect } from 'chai';
import { DST_CHAIN_ID, EXECUTOR_ADDRESS } from './consts';

const envConfig = require('dotenv').config();
const {
    ROUTERS_BSC: TEST_ROUTERS,
    NATIVE_BSC: TEST_NATIVE,
    BUS_BSC: TEST_BUS,
    TRANSIT_BSC: TEST_TRANSIT,
    SWAP_TOKEN_BSC: TEST_SWAP_TOKEN
} = envConfig.parsed || {};

interface SwapContractFixture {
    swapMain: RubicRouterV2;
    swapToken: TestERC20;
    transitToken: TestERC20;
    wnative: WETH9;
    router: string;
    routerV3: string;
    testMessagesContract: TestMessages;
    messageBus: MessageBusSender;
}

export const swapContractFixtureInFork: Fixture<SwapContractFixture> = async function (
    wallets
): Promise<SwapContractFixture> {
    const tokenFactory = ethers.ContractFactory.fromSolidity(TokenJSON);
    let transitToken = tokenFactory.attach(TEST_TRANSIT) as TestERC20;
    transitToken = transitToken.connect(wallets[0]);

    const swapTokenFactory = ethers.ContractFactory.fromSolidity(TokenJSON);
    let swapToken = swapTokenFactory.attach(TEST_SWAP_TOKEN) as TestERC20;
    swapToken = swapToken.connect(wallets[0]);

    const wnativeFactory = ethers.ContractFactory.fromSolidity(WETHJSON);
    let wnative = wnativeFactory.attach(TEST_NATIVE) as WETH9;
    wnative = wnative.connect(wallets[0]);

    const RubicRouterV2Factory = await ethers.getContractFactory('RubicRouterV2');

    const availableRouters = TEST_ROUTERS.split(',');
    const router = availableRouters[0];
    const routerV3 = availableRouters[1];

    const swapMain = (await RubicRouterV2Factory.deploy(
        [],
        [],
        [],
        [],
        [],
        [],
        availableRouters,
        EXECUTOR_ADDRESS,
        TEST_BUS,
        TEST_NATIVE
    )) as RubicRouterV2;

    await swapMain.setFeeAmountOfBlockchain(DST_CHAIN_ID, '6000');

    const testMessagesFactory = await ethers.getContractFactory('TestMessages');
    const testMessagesContract = (await testMessagesFactory.deploy()) as TestMessages;

    const messageBusFactory = ethers.ContractFactory.fromSolidity(MessageBusJSON);
    let messageBus = messageBusFactory.attach(TEST_BUS) as MessageBusSender;
    messageBus = messageBus.connect(wallets[0]);

    const abiCoder = ethers.utils.defaultAbiCoder;

    const storageBalancePositionTransit = ethers.utils.keccak256(
        abiCoder.encode(['address'], [wallets[0].address]) +
            abiCoder.encode(['uint256'], [1]).slice(2, 66)
    );

    const storageBalancePositionSwap = ethers.utils.keccak256(
        abiCoder.encode(['address'], [wallets[0].address]) +
            abiCoder.encode(['uint256'], [1]).slice(2, 66)
    );

    await network.provider.send('hardhat_setStorageAt', [
        transitToken.address,
        storageBalancePositionTransit,
        abiCoder.encode(['uint256'], [ethers.utils.parseEther('100000')])
    ]);

    await network.provider.send('hardhat_setStorageAt', [
        swapToken.address,
        storageBalancePositionSwap,
        abiCoder.encode(['uint256'], [ethers.utils.parseEther('100000')])
    ]);

    expect(await transitToken.balanceOf(wallets[0].address)).to.eq(
        ethers.utils.parseEther('100000')
    );

    expect(await swapToken.balanceOf(wallets[0].address)).to.eq(ethers.utils.parseEther('100000'));

    await network.provider.send('hardhat_setBalance', [
        wallets[0].address,
        '0x152D02C7E14AF6800000' // 100000 eth
    ]);

    return {
        swapMain,
        swapToken,
        transitToken,
        wnative,
        router,
        routerV3,
        testMessagesContract,
        messageBus
    };
};
