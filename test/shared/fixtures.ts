import { Fixture } from 'ethereum-waffle';
import { ethers } from 'hardhat';
import { TestERC20 } from '../../typechain-types';
import { SwapMain } from '../../typechain-types';

const envConfig = require('dotenv').config();
const { ROUTERS_POLYGON, NATIVE_POLYGON, BUS_POLYGON } = envConfig.parsed || {};

async function testTokenFixture(): Promise<{ token: TestERC20 }> {
    const token = (await (await ethers.getContractFactory('TestERC20')).deploy()) as TestERC20;

    return { token };
}

interface SwapContractFixture {
    swapMain: SwapMain;
    token: TestERC20;
}

export const swapContractFixture: Fixture<SwapContractFixture> =
    async function (): Promise<SwapContractFixture> {
        const { token } = await testTokenFixture();

        const swapMainFactory = await ethers.getContractFactory('SwapMain');

        const supportedDEXes = ROUTERS_POLYGON.split(',');

        const swapMain = (await swapMainFactory.deploy(
            BUS_POLYGON,
            supportedDEXes,
            NATIVE_POLYGON,
            token.address
        )) as SwapMain;

        return { swapMain, token };
    };
