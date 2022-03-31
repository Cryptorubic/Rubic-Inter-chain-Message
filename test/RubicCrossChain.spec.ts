import { ethers, network, waffle } from 'hardhat';
import { swapContractFixtureInFork, swapContractFixtureWithLocalToken } from './shared/fixtures';
import { Wallet } from '@ethersproject/wallet';
import { SwapMain, TestERC20, WETH9 } from '../typechain-types';
import { expect } from 'chai';
import { AbiCoder } from '@ethersproject/abi';
import { DEADLINE, DST_CHAIN_ID } from './shared/consts';
import { BigNumberish, ContractTransaction } from 'ethers';
import { getRouterV2 } from './shared/utils';
import {parseUnits} from "ethers/lib/utils";

const createFixtureLoader = waffle.createFixtureLoader;
const defaultAmountIn = ethers.utils.parseEther('1');

const envConfig = require('dotenv').config();
const { ROUTERS_POLYGON, NATIVE_POLYGON, BUS_POLYGON } = envConfig.parsed || {};

describe('RubicCrossChain', () => {
    let wallet: Wallet, other: Wallet;
    let token: TestERC20;
    let swapMain: SwapMain;
    let router: string;
    let wnative: WETH9;

    let loadFixture: ReturnType<typeof createFixtureLoader>;
    let abiCoder: AbiCoder;

    async function callTransferWithSwapV2Native(
        amountOutMinimum: BigNumberish,
        {
            receiver = null,
            amountIn = defaultAmountIn,
            cBridgePart = '0',
            dstChainID = DST_CHAIN_ID,
            srcDEX = router,
            srcPath = [wnative.address, token.address],
            nativeOut = false,
            nativeIn = null
        } = {}
    ): Promise<ContractTransaction> {
        const cryptoFee = await swapMain.dstCryptoFee(dstChainID);

        return swapMain.transferWithSwapV2Native(
            receiver === null ? await swapMain.signer.getAddress() : receiver,
            amountIn,
            cBridgePart,
            dstChainID,
            {
                dex: srcDEX,
                path: srcPath,
                deadline: DEADLINE,
                amountOutMinimum
            },
            {
                dex: router,
                version: 1,
                path: [wnative.address, token.address],
                dataInchOrPathV3: '0x',
                deadline: DEADLINE,
                amountOutMinimum: ethers.utils.parseEther('10')
            },
            '10',
            nativeOut,
            { value: nativeIn === null ? amountIn.add(cryptoFee) : nativeIn }
        );
    }

    async function getAmountOutMin(amountIn = defaultAmountIn) {
        const routerV2 = await getRouterV2(wallet, router);

        return (await routerV2.getAmountsOut(amountIn, [wnative.address, token.address]))[1];
    }

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    beforeEach('deploy fixture', async () => {
        ({ swapMain, token, wnative, router } = await loadFixture(swapContractFixtureInFork));

        abiCoder = ethers.utils.defaultAbiCoder;

        const storageBalancePosition = ethers.utils.keccak256(
            abiCoder.encode(['address'], [wallet.address]) +
                abiCoder.encode(['uint256'], [0]).slice(2, 66)
        );

        await network.provider.send('hardhat_setStorageAt', [
            token.address,
            storageBalancePosition,
            abiCoder.encode(['uint256'], [ethers.utils.parseEther('100000')])
        ]);

        expect(await token.balanceOf(wallet.address)).to.eq(ethers.utils.parseEther('100000'));

        await network.provider.send('hardhat_setBalance', [
            wallet.address,
            '0x152D02C7E14AF6800000' // 100000 eth
        ]);
    });

    it('constructor initializes', async () => {
        expect(await swapMain.nativeWrap()).to.eq(NATIVE_POLYGON);
        expect(await swapMain.rubicTransit()).to.eq(token.address);
        expect(await swapMain.messageBus()).to.eq(BUS_POLYGON);

        const routers = ROUTERS_POLYGON.split(',');
        expect(await swapMain.getSupportedDEXes()).to.deep.eq(routers);
    });

    describe('#WithSwapTests', () => {
        describe('#transferWithSwapV2Native success', () => {
            it('Rubic only', async () => {
                const amountOutMin = await getAmountOutMin();

                await expect(callTransferWithSwapV2Native(amountOutMin))
                    .to.emit(swapMain, 'TransferTokensToOtherBlockchainUser')
                    .withArgs(amountOutMin, defaultAmountIn);

                expect(await token.balanceOf(swapMain.address)).to.be.eq(amountOutMin);
            });
            it.only('Celer only', async () => {
                const amountOutMin = await getAmountOutMin();

                await expect(callTransferWithSwapV2Native(amountOutMin, { cBridgePart: '1000000' }))
                    .to.emit(swapMain, 'SwapRequestSentV2')
                    .withArgs(
                        ethers.constants.HashZero,
                        DST_CHAIN_ID,
                        defaultAmountIn,
                        wnative.address
                    );
            });
        });
        describe('#transferWithSwapV2', () => {
            
        });
    });
});
