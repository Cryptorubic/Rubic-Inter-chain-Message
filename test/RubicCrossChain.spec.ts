import {ethers, network, waffle} from 'hardhat';
import {swapContractFixtureInFork, testFixture} from './shared/fixtures';
import {Wallet} from '@ethersproject/wallet';
import {SwapMain, TestERC20, TestMessages, WETH9} from '../typechain-types';
import {expect} from 'chai';
import {AbiCoder} from '@ethersproject/abi';
import {DEADLINE, DST_CHAIN_ID} from './shared/consts';
import {BigNumber, BigNumber as BN, BigNumberish, BytesLike, ContractTransaction} from 'ethers';
import {createPoolV2, getRouterV2} from './shared/utils';

const createFixtureLoader = waffle.createFixtureLoader;
const defaultAmountIn = ethers.utils.parseEther('1');

const envConfig = require('dotenv').config();
const { ROUTERS_POLYGON, NATIVE_POLYGON, BUS_POLYGON } = envConfig.parsed || {};

describe('RubicCrossChain', () => {
    let wallet: Wallet, other: Wallet;
    let swapToken: TestERC20;
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

    async function callTransferWithSwapV2(
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
                version: 1,
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
        amountIn = defaultAmountIn,
        path = [wnative.address, token.address]
    ) {
        const routerV2 = await getRouterV2(wallet, router);

        return (await routerV2.getAmountsOut(amountIn, path))[1];
    }

    async function getMessageAndID(
        messagesContract: TestMessages,
        _nonce: BigNumberish,
        {
            dex = router,
            version = 1,
            path = [wnative.address, token.address],
            dataInchOrPathV3 = '0x',
            deadline = DEADLINE,
            amountOutMinimum = ethers.utils.parseEther('10'),
            _receiver = wallet.address,
            _nativeOut = false
        } = {}
    ): Promise<{ message: string; ID: string }> {
        const message = await messagesContract.getMessage(
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

        const ID = await messagesContract.getID(
            _receiver,
            (
                await ethers.provider.getNetwork()
            ).chainId,
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

        return { message, ID };
    }

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    beforeEach('deploy fixture', async () => {
        ({ swapMain, swapToken, token, wnative, router } = await loadFixture(
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
        expect(await swapMain.nativeWrap()).to.eq(NATIVE_POLYGON);
        expect(await swapMain.rubicTransit()).to.eq(token.address);
        expect(await swapMain.messageBus()).to.eq(BUS_POLYGON);

        const routers = ROUTERS_POLYGON.split(',');
        expect(await swapMain.getSupportedDEXes()).to.deep.eq(routers);
    });

    describe('#WithSwapTests', () => {
        describe('#transferWithSwapV2Native', () => {
            beforeEach('add liquidity transit with native', async () => {
                await token.approve(router, ethers.constants.MaxUint256);
                await createPoolV2(
                    wallet,
                    router,
                    token.address,
                    BN.from('100' + '0'.repeat(Number(await token.decimals())))
                );
            });

            it('Should swap native and transfer through Rubic only', async () => {
                const amountOutMin = await getAmountOutMin();

                await expect(callTransferWithSwapV2Native(amountOutMin))
                    .to.emit(swapMain, 'TransferTokensToOtherBlockchainUser')
                    .withArgs(amountOutMin, defaultAmountIn);

                expect(await token.balanceOf(swapMain.address)).to.be.eq(amountOutMin);
            });
            it('Should swap native and transfer through Celer only', async () => {
                const { testMessagesContract } = await loadFixture(testFixture);

                const { message } = await getMessageAndID(
                    testMessagesContract,
                    (await swapMain.nonce()).add('1')
                );

                const amountOutMin = await getAmountOutMin();

                await expect(
                    callTransferWithSwapV2Native(amountOutMin, {
                        cBridgePart: '1000000'
                    })
                )
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
            it('Should swap token and transfer through Rubic only', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);

                const amountOutMin = await getAmountOutMin(defaultAmountIn, [
                    swapToken.address,
                    token.address
                ]);

                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, token.address]
                    })
                )
                    .to.emit(swapMain, 'TransferTokensToOtherBlockchainUser')
                    .withArgs(amountOutMin, defaultAmountIn);

                expect(await token.balanceOf(swapMain.address)).to.be.eq(amountOutMin);
            });
            it.only('Should swap token and transfer through Сeler only', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);

                const amountOutMin = await getAmountOutMin(defaultAmountIn, [
                    swapToken.address,
                    token.address
                ]);

                const { testMessagesContract } = await loadFixture(testFixture);

                const { message, ID } = await getMessageAndID(
                    testMessagesContract,
                    (await swapMain.nonce()).add('1')
                );
                console.log(message);

                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, token.address],
                        cBridgePart: '1000000'
                    })
                )
                    .to.emit(swapMain, 'SwapRequestSentV2')
                    .withArgs(ID, DST_CHAIN_ID, defaultAmountIn, swapToken.address);
            });
        });
        //describe('#')
    });
});
