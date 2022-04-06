import { ethers, network, waffle } from 'hardhat';
import { swapContractFixtureInFork } from './shared/fixtures';
import { Wallet } from '@ethersproject/wallet';
import { SwapMain, TestERC20, TestMessages, WETH9 } from '../typechain-types';
import { expect } from 'chai';
import { AbiCoder } from '@ethersproject/abi';
import { DEADLINE, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, VERSION } from './shared/consts';
import { BigNumber as BN, BigNumberish, ContractTransaction } from 'ethers';
import { getRouterV2 } from './shared/utils';

const createFixtureLoader = waffle.createFixtureLoader;

const envConfig = require('dotenv').config();
const {
    ROUTERS_BSC_TESTNET: TEST_ROUTERS,
    NATIVE_BSC_TESTNET: TEST_NATIVE,
    BUS_BSC_TESTNET: TEST_BUS,
    TRANSIT_BSC_TESTNET: TEST_TRANSIT,
    SWAP_TOKEN_BSC_TESTNET: TEST_SWAP_TOKEN
} = envConfig.parsed || {};

describe('RubicCrossChain', () => {
    let wallet: Wallet, other: Wallet;
    let swapToken: TestERC20;
    let token: TestERC20;
    let swapMain: SwapMain;
    let router: string;
    let wnative: WETH9;

    let testMessagesContract: TestMessages;

    let loadFixture: ReturnType<typeof createFixtureLoader>;
    let abiCoder: AbiCoder;

    async function callTransferWithSwapV2Native(
        amountOutMinimum: BigNumberish,
        {
            receiver = null,
            amountIn = DEFAULT_AMOUNT_IN,
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
            receiver === null ? wallet.address : receiver,
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
                version: VERSION,
                path: [wnative.address, token.address],
                dataInchOrPathV3: '0x',
                deadline: DEADLINE,
                amountOutMinimum: ethers.utils.parseEther('10')
            },
            '10',
            nativeOut,
            {
                value:
                    nativeIn === null
                        ? amountIn.add(cryptoFee).add(ethers.utils.parseEther('2'))
                        : nativeIn
            }
        );
    }

    async function callTransferWithSwapV2(
        amountOutMinimum: BigNumberish,
        {
            receiver = null,
            amountIn = DEFAULT_AMOUNT_IN,
            cBridgePart = '0',
            dstChainID = DST_CHAIN_ID,
            srcDEX = router,
            srcPath = [wnative.address, token.address],
            nativeOut = false,
            nativeIn = null
        } = {}
    ): Promise<ContractTransaction> {
        const cryptoFee = await swapMain.dstCryptoFee(dstChainID);

        return swapMain.transferWithSwapV2(
            receiver === null ? wallet.address : receiver,
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
                version: VERSION,
                path: [wnative.address, token.address],
                dataInchOrPathV3: '0x',
                deadline: DEADLINE,
                amountOutMinimum: ethers.utils.parseEther('10')
            },
            '10',
            nativeOut,
            { value: nativeIn === null ? cryptoFee.add(ethers.utils.parseEther('0.01')) : nativeIn }
        );
    }

    async function getAmountOutMin(
        amountIn = DEFAULT_AMOUNT_IN,
        path = [wnative.address, token.address]
    ) {
        const routerV2 = await getRouterV2(wallet, router);

        return (await routerV2.getAmountsOut(amountIn, path))[1];
    }

    async function getMessage(
        messagesContract: TestMessages,
        _nonce: BigNumberish,
        {
            dex = router,
            version = VERSION,
            path = [wnative.address, token.address],
            dataInchOrPathV3 = '0x',
            deadline = DEADLINE,
            amountOutMinimum = ethers.utils.parseEther('10'),
            _receiver = wallet.address,
            _nativeOut = false
        } = {}
    ): Promise<string> {
        return messagesContract.getMessage(
            {
                dex,
                version,
                path,
                dataInchOrPathV3,
                deadline,
                amountOutMinimum
            },
            _receiver,
            _nonce,
            _nativeOut
        );
    }

    async function getID(
        messagesContract: TestMessages,
        _nonce: BigNumberish,
        {
            dex = router,
            version = VERSION,
            path = [wnative.address, token.address],
            dataInchOrPathV3 = '0x',
            deadline = DEADLINE,
            amountOutMinimum = ethers.utils.parseEther('10'),
            _receiver = wallet.address,
            _nativeOut = false
        } = {}
    ): Promise<string> {
        return messagesContract.getID(
            _receiver,
            (await ethers.provider.getNetwork()).chainId,
            DST_CHAIN_ID,
            {
                dex,
                version,
                path,
                dataInchOrPathV3,
                deadline,
                amountOutMinimum
            },
            _nonce,
            _nativeOut
        );
    }

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    beforeEach('deploy fixture', async () => {
        ({ swapMain, swapToken, token, wnative, router, testMessagesContract } = await loadFixture(
            swapContractFixtureInFork
        ));

        abiCoder = ethers.utils.defaultAbiCoder;

        const storageBalancePositionTransit = ethers.utils.keccak256(
            abiCoder.encode(['address'], [wallet.address]) +
                abiCoder.encode(['uint256'], [0]).slice(2, 66)
        );

        const storageBalancePositionSwap = ethers.utils.keccak256(
            abiCoder.encode(['address'], [wallet.address]) +
                abiCoder.encode(['uint256'], [0]).slice(2, 66)
        );

        // for (let i = 0; i < 5; i++) {
        //     console.log(i, await ethers.provider.getStorageAt(token.address, i));
        // }

        await network.provider.send('hardhat_setStorageAt', [
            token.address,
            storageBalancePositionTransit,
            abiCoder.encode(['uint256'], [ethers.utils.parseEther('100000')])
        ]);

        await network.provider.send('hardhat_setStorageAt', [
            swapToken.address,
            storageBalancePositionSwap,
            abiCoder.encode(['uint256'], [ethers.utils.parseEther('100000')])
        ]);

        expect(await token.balanceOf(wallet.address)).to.eq(ethers.utils.parseEther('100000'));
        expect(await swapToken.balanceOf(wallet.address)).to.eq(ethers.utils.parseEther('100000'));

        await network.provider.send('hardhat_setBalance', [
            wallet.address,
            '0x152D02C7E14AF6800000' // 100000 eth
        ]);
    });

    it('constructor initializes', async () => {
        expect(await swapMain.nativeWrap()).to.eq(TEST_NATIVE);
        expect(await swapMain.rubicTransit()).to.eq(token.address);
        expect(await swapMain.messageBus()).to.eq(TEST_BUS);

        const routers = TEST_ROUTERS.split(',');
        expect(await swapMain.getSupportedDEXes()).to.deep.eq(routers);
    });

    describe('#WithSwapTests', () => {
        describe('#transferWithSwapV2Native', () => {
            it('Should swap native and transfer through Rubic only', async () => {
                const amountOutMin = await getAmountOutMin();

                await expect(callTransferWithSwapV2Native(amountOutMin))
                    .to.emit(swapMain, 'TransferTokensToOtherBlockchainUser')
                    .withArgs(amountOutMin, DEFAULT_AMOUNT_IN);

                expect(await token.balanceOf(swapMain.address)).to.be.eq(amountOutMin);
            });
            it('Should swap native and transfer through Celer only', async () => {
                const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));

                const amountOutMin = await getAmountOutMin();

                await expect(
                    callTransferWithSwapV2Native(amountOutMin, {
                        cBridgePart: '1000000',
                        srcPath: [wnative.address, token.address]
                    })
                )
                    .to.emit(swapMain, 'SwapRequestSentV2')
                    .withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, wnative.address);
            });
        });
        describe('#transferWithSwapV2', () => {
            it('Should swap token and transfer through Rubic only', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);
                const amountOutMin = await getAmountOutMin(DEFAULT_AMOUNT_IN, [
                    swapToken.address,
                    token.address
                ]);
                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, token.address]
                    })
                )
                    .to.emit(swapMain, 'TransferTokensToOtherBlockchainUser')
                    .withArgs(amountOutMin, DEFAULT_AMOUNT_IN);

                expect(await token.balanceOf(swapMain.address)).to.be.eq(amountOutMin);
            });
            it('Should swap token and transfer through Сeler only', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);

                const amountOutMin = await getAmountOutMin(DEFAULT_AMOUNT_IN, [
                    swapToken.address,
                    token.address
                ]);

                const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));
                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, token.address],
                        cBridgePart: '1000000'
                    })
                )
                    .to.emit(swapMain, 'SwapRequestSentV2')
                    .withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, swapToken.address);
            });
        });
        //describe('#')
    });
});
