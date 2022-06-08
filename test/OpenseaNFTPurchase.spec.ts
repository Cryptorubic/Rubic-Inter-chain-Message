import { ethers, network, waffle } from 'hardhat';
import { swapContractFixtureInFork } from './shared/fixtures';
import { Wallet } from '@ethersproject/wallet';
import { RubicRouterV2, TestERC20, TestMessages, WETH9 } from '../typechain';
import { expect } from 'chai';
import {
    DEADLINE,
    DST_CHAIN_ID,
    DEFAULT_AMOUNT_IN,
    VERSION_V2,
    DEFAULT_AMOUNT_OUT_MIN,
    EXECUTOR_ADDRESS,
    INTEGRATOR,
    feeDecimals,
    DEFAULT_AMOUNT_IN_USDC
} from './shared/consts';
import { BigNumber as BN, BigNumberish, ContractTransaction } from 'ethers';
import { getRouterV2 } from './shared/utils';
const hre = require('hardhat');

const createFixtureLoader = waffle.createFixtureLoader;

const envConfig = require('dotenv').config();
const {
    ROUTERS_POLYGON: TEST_ROUTERS,
    NATIVE_POLYGON: TEST_NATIVE,
    BUS_POLYGON_MAIN: TEST_BUS
} = envConfig.parsed || {};

describe('RubicCrossChainV2', () => {
    let wallet: Wallet, other: Wallet;
    let swapToken: TestERC20;
    let transitToken: TestERC20;
    let swapMain: RubicRouterV2;
    let router: string;
    let wnative: WETH9;
    let chainId: number;

    let testMessagesContract: TestMessages;

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    async function callTransferWithSwapV2Native(
        amountOutMinimum: BigNumberish,
        {
            receiver = null,
            amountIn = DEFAULT_AMOUNT_IN,
            dstChainID = DST_CHAIN_ID,
            srcDEX = router,
            srcPath = [wnative.address, transitToken.address],
            nativeIn = null,
            integrator = INTEGRATOR,
            nativeOut = true
        } = {}
    ): Promise<ContractTransaction> {
        const cryptoFee = await swapMain.dstCryptoFee(dstChainID);

        return swapMain.transferWithSwapV2Native(
            receiver === null ? wallet.address : receiver,
            amountIn,
            dstChainID,
            {
                dex: srcDEX,
                path: srcPath,
                deadline: DEADLINE,
                amountOutMinimum
            },
            {
                dex: router,
                nativeOut: nativeOut,
                integrator: integrator,
                version: VERSION_V2,
                path: [wnative.address, transitToken.address],
                pathV3: '0x',
                deadline: DEADLINE,
                amountOutMinimum: DEFAULT_AMOUNT_OUT_MIN
            },
            '10000',
            {
                value:
                    nativeIn === null
                        ? amountIn.add(cryptoFee).add(ethers.utils.parseEther('0.1'))
                        : nativeIn
            }
        );
    }

    async function callTransferWithSwapV2(
        amountOutMinimum: BigNumberish,
        {
            receiver = null,
            amountIn = DEFAULT_AMOUNT_IN,
            dstChainID = DST_CHAIN_ID,
            srcDEX = router,
            srcPath = [wnative.address, transitToken.address],
            nativeIn = null,
            integrator = INTEGRATOR,
            nativeOut = true
        } = {}
    ): Promise<ContractTransaction> {
        const cryptoFee = await swapMain.dstCryptoFee(dstChainID);

        return swapMain.transferWithSwapV2(
            receiver === null ? wallet.address : receiver,
            amountIn,
            dstChainID,
            {
                dex: srcDEX,
                path: srcPath,
                deadline: DEADLINE,
                amountOutMinimum
            },
            {
                dex: router,
                nativeOut: nativeOut,
                integrator: integrator,
                version: VERSION_V2,
                path: [wnative.address, transitToken.address],
                pathV3: '0x',
                deadline: DEADLINE,
                amountOutMinimum: DEFAULT_AMOUNT_OUT_MIN
            },
            '10000',
            { value: nativeIn === null ? cryptoFee.add(ethers.utils.parseEther('0.01')) : nativeIn }
        );
    }

    async function getAmountOutMin(
        amountIn = DEFAULT_AMOUNT_IN,
        path = [wnative.address, transitToken.address]
    ) {
        const routerV2 = await getRouterV2(wallet, router);

        return (await routerV2.getAmountsOut(amountIn, path))[1];
    }

    // async function getAmountIn(
    //     amountOut = DEFAULT_AMOUNT_OUT_MIN,
    //     path = [transitToken.address, swapToken.address]
    // ) {
    //     const routerV2 = await getRouterV2(wallet, router);
    //     return (await routerV2.getAmountsIn(amountOut, path))[0];
    // }

    async function getMessage(
        messagesContract: TestMessages,
        _nonce: BigNumberish,
        dstChainId: BigNumberish,
        {
            dex = router,
            integrator = INTEGRATOR,
            version = VERSION_V2,
            path = [wnative.address, transitToken.address],
            pathV3 = '0x',
            deadline = DEADLINE,
            amountOutMinimum = DEFAULT_AMOUNT_OUT_MIN,
            _receiver = wallet.address,
            nativeOut = true
        } = {}
    ): Promise<string> {
        return messagesContract.getMessage(
            {
                dex,
                nativeOut,
                integrator,
                version,
                path,
                pathV3,
                deadline,
                amountOutMinimum
            },
            _receiver,
            _nonce,
            dstChainId
        );
    }

    async function getID(
        messagesContract: TestMessages,
        _nonce: BigNumberish,
        {
            dex = router,
            integrator = INTEGRATOR,
            version = VERSION_V2,
            path = [wnative.address, transitToken.address],
            pathV3 = '0x',
            deadline = DEADLINE,
            amountOutMinimum = DEFAULT_AMOUNT_OUT_MIN,
            _receiver = wallet.address,
            nativeOut = true,
            _srcChainId = chainId,
            _dstChainId = DST_CHAIN_ID
        } = {}
    ): Promise<string> {
        return messagesContract.getID(
            _receiver,
            _srcChainId,
            _dstChainId,
            {
                dex,
                nativeOut,
                integrator,
                version,
                path,
                pathV3,
                deadline,
                amountOutMinimum
            },
            _nonce
        );
    }

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
        chainId = (await ethers.provider.getNetwork()).chainId;
    });

    beforeEach('deploy fixture', async () => {
        ({ swapMain, swapToken, transitToken, wnative, router, testMessagesContract } =
            await loadFixture(swapContractFixtureInFork));
    });

});
