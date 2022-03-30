import { Fixture } from 'ethereum-waffle';
import { ethers } from 'hardhat';
import { TestERC20 } from '../../typechain-types';
import { SwapMain } from '../../typechain-types';
import { WETH9 } from '../../typechain-types';
import TokenJSON from '../../artifacts/contracts/test/TestERC20.sol/TestERC20.json';
import WETHJSON from '../../artifacts/contracts/test/WETH9.sol/WETH9.json';

const envConfig = require('dotenv').config();
const {
    ROUTERS_POLYGON: TEST_ROUTERS,
    NATIVE_POLYGON: TEST_NATIVE,
    BUS_POLYGON: TEST_BUS,
    TRANSIT_POLYGON: TEST_TRANSIT
} = envConfig.parsed || {};

async function testTokenFixture(): Promise<{ token: TestERC20 }> {
    const token = (await (await ethers.getContractFactory('TestERC20')).deploy()) as TestERC20;

    return { token };
}

interface SwapContractFixture {
    swapMain: SwapMain;
    token: TestERC20;
    wnative: WETH9;
    router: string;
}

export const swapContractFixtureWithLocalToken: Fixture<SwapContractFixture> = async function (
    wallets
): Promise<SwapContractFixture> {
    const { token } = await testTokenFixture();

    const wnativeFactory = ethers.ContractFactory.fromSolidity(WETHJSON);
    let wnative = wnativeFactory.attach(TEST_NATIVE) as WETH9;
    wnative = wnative.connect(wallets[0]);

    const swapMainFactory = await ethers.getContractFactory('SwapMain');

    const supportedDEXes = TEST_ROUTERS.split(',');
    const router = supportedDEXes[0];

    const swapMain = (await swapMainFactory.deploy(
        TEST_BUS,
        supportedDEXes,
        TEST_NATIVE,
        token.address
    )) as SwapMain;

    return { swapMain, token, wnative, router };
};

export const swapContractFixtureInFork: Fixture<SwapContractFixture> = async function (
    wallets
): Promise<SwapContractFixture> {
    const tokenFactory = ethers.ContractFactory.fromSolidity(TokenJSON);
    let token = tokenFactory.attach(TEST_TRANSIT) as TestERC20;
    token = token.connect(wallets[0]);

    const wnativeFactory = ethers.ContractFactory.fromSolidity(WETHJSON);
    let wnative = wnativeFactory.attach(TEST_NATIVE) as WETH9;
    wnative = wnative.connect(wallets[0]);

    const swapMainFactory = await ethers.getContractFactory('SwapMain');

    const supportedDEXes = TEST_ROUTERS.split(',');
    const router = supportedDEXes[0];

    const swapMain = (await swapMainFactory.deploy(
        TEST_BUS,
        supportedDEXes,
        TEST_NATIVE,
        TEST_TRANSIT
    )) as SwapMain;

    return { swapMain, token, wnative, router };
};
