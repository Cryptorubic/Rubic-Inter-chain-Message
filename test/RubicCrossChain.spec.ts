import { ethers, waffle } from 'hardhat';
import { swapContractFixture } from './shared/fixtures';
import { Wallet } from '@ethersproject/wallet';
import { SwapMain, TestERC20 } from '../typechain-types';
import { expect } from 'chai';

const createFixtureLoader = waffle.createFixtureLoader;

const envConfig = require('dotenv').config();
const { ROUTERS_POLYGON, NATIVE_POLYGON, BUS_POLYGON } = envConfig.parsed || {};

describe('RubicCrossChain', () => {
    let wallet: Wallet, other: Wallet;
    let token: TestERC20;
    let swapMain: SwapMain;

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    beforeEach('deploy fixture', async () => {
        ({ swapMain, token } = await loadFixture(swapContractFixture));
    });

    it('constructor initializes', async () => {
        expect(await swapMain.nativeWrap()).to.eq(NATIVE_POLYGON);
        expect(await swapMain.rubicTransit()).to.eq(token.address);
        expect(await swapMain.messageBus()).to.eq(BUS_POLYGON);

        const routers = ROUTERS_POLYGON.split(',');
        expect(await swapMain.getSupportedDEXes()).to.deep.eq(routers);
    });
});
