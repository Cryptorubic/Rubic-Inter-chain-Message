import { ethers, network, waffle } from 'hardhat';
import { swapContractFixtureInFork } from './shared/fixtures';
import { Wallet } from '@ethersproject/wallet';
import {
    RubicRouterV2,
    TestERC20,
    TestMessages,
    WETH9,
    IKephiExchange__factory
} from '../typechain';
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
    ROUTERS_BSC: TEST_ROUTERS,
    NATIVE_BSC: TEST_NATIVE,
    BUS_BSC: TEST_BUS
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
        const cryptoFee = await swapMain.blockchainCryptoFee(dstChainID);

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
                NFTPurchaseInfo: {
                    marketID: 0,
                    value: 0,
                    data: '0x'
                },
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
        const cryptoFee = await swapMain.blockchainCryptoFee(dstChainID);

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
                NFTPurchaseInfo: {
                    marketID: 0,
                    value: 0,
                    data: '0x'
                },
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
            integrator = ethers.constants.AddressZero,
            version = VERSION_V2,
            path = [wnative.address, transitToken.address],
            pathV3 = '0x',
            deadline = DEADLINE,
            amountOutMinimum = DEFAULT_AMOUNT_OUT_MIN,
            _receiver = wallet.address,
            nativeOut = true,
            /// NFT ///
            marketID = 0,
            value = BN.from('0'),
            data = '0x'
        } = {}
    ): Promise<string> {
        const NFTPurchaseInfo = { marketID, value, data };

        return messagesContract.getMessage(
            {
                dex,
                nativeOut,
                integrator,
                version,
                path,
                pathV3,
                NFTPurchaseInfo,
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
            _dstChainId = DST_CHAIN_ID,
            /// NFT ///
            marketID = 0,
            value = BN.from('0'),
            data = '0x'
        } = {}
    ): Promise<string> {
        const NFTPurchaseInfo = { marketID, value, data };

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
                NFTPurchaseInfo,
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

    it('constructor initializes', async () => {
        expect(await swapMain.nativeWrap()).to.eq(TEST_NATIVE);
        expect(await swapMain.messageBus()).to.eq(TEST_BUS);

        const routers = TEST_ROUTERS.split(',');
        expect(await swapMain.getAvailableRouters()).to.deep.eq(routers);
    });

    describe('#WithSwapTests', () => {
        describe('#transferWithSwapV2Native', () => {
            it('Should swap native to token and transfer through Celer', async () => {
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('10000')
                );

                const amountOutMin = await getAmountOutMin(
                    ethers.BigNumber.from('20000000000000000000')
                );
                const _amountIn = ethers.BigNumber.from('20000000000000000000');

                await expect(
                    callTransferWithSwapV2Native(amountOutMin, {
                        amountIn: _amountIn,
                        srcPath: [wnative.address, transitToken.address]
                    })
                ).to.emit(swapMain, 'SwapRequestSentV2');
            });
            it('Should swap native to token and fail transfer through Celer', async () => {
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('10000')
                );

                const amountOutMin = await getAmountOutMin(BN.from('10000'));

                await expect(
                    callTransferWithSwapV2Native(amountOutMin, {
                        amountIn: BN.from('10000'),
                        srcPath: [wnative.address, transitToken.address]
                    })
                ).to.be.revertedWith('amount too small');
            });
        });
        describe('#transferWithSwapV2', () => {
            it('Should swap token to transitToken and transfer through Сeler', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('10000')
                );

                const amountOutMin = await getAmountOutMin(DEFAULT_AMOUNT_IN_USDC, [
                    swapToken.address,
                    transitToken.address
                ]);

                const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));
                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, transitToken.address]
                    })
                )
                    .to.emit(swapMain, 'SwapRequestSentV2')
                    .withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, swapToken.address);
            });

            it('Should swap token to native and transfer through Сeler', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);
                await swapMain.setMaxTokenAmount(wnative.address, ethers.utils.parseEther('10000'));

                // amountIn is 100$
                const amountOutMin = await getAmountOutMin(DEFAULT_AMOUNT_IN_USDC, [
                    swapToken.address,
                    wnative.address
                ]);

                const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));

                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, wnative.address]
                    })
                )
                    .to.emit(swapMain, 'SwapRequestSentV2')
                    .withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, swapToken.address);
            });
        });
        describe('#executeMessageWithTransfer', () => {
            let platformFee;
            beforeEach('setup for target executions', async () => {
                await transitToken.transfer(swapMain.address, DEFAULT_AMOUNT_IN.mul('100'));
                platformFee = await swapMain.feeAmountOfBlockchain(DST_CHAIN_ID);
            });
            describe('target swap should emit correct event', async () => {
                let nonce: BN;
                let message: string;

                beforeEach('setup before swap', async () => {
                    nonce = (await swapMain.nonce()).add('1');

                    message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                        path: [transitToken.address, swapToken.address],
                        amountOutMinimum: ethers.BigNumber.from('200000000000000000') // 0.2 eth for 1000$ is min
                    });
                });
                it('should successfully swap V2 with rubic fee', async () => {
                    await hre.network.provider.request({
                        method: 'hardhat_impersonateAccount',
                        params: [TEST_BUS]
                    });

                    const bus = await ethers.getSigner(TEST_BUS);

                    await network.provider.send('hardhat_setBalance', [
                        bus.address,
                        '0x152D02C7E14AF6800000' // 100000 eth
                    ]);

                    const _swapMain = swapMain.connect(bus);

                    let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);
                    await expect(
                        _swapMain.executeMessageWithTransfer(
                            ethers.constants.AddressZero,
                            transitToken.address,
                            DEFAULT_AMOUNT_IN,
                            DST_CHAIN_ID,
                            message,
                            EXECUTOR_ADDRESS
                        )
                    ).to.emit(swapMain, 'SwapRequestDone');
                    let tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                    // take only platform comission in transit token
                    await expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.eq(
                        DEFAULT_AMOUNT_IN.mul(BN.from(feeDecimals).sub(platformFee)).div(
                            feeDecimals
                        )
                    );
                });

                it('should fail swap V2 with rubic fee and transfer tokens', async () => {
                    await hre.network.provider.request({
                        method: 'hardhat_impersonateAccount',
                        params: [TEST_BUS]
                    });

                    const bus = await ethers.getSigner(TEST_BUS);

                    await network.provider.send('hardhat_setBalance', [
                        bus.address,
                        '0x152D02C7E14AF6800000' // 100000 eth
                    ]);

                    const _swapMain = swapMain.connect(bus);

                    message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                        path: [transitToken.address, swapToken.address],
                        amountOutMinimum: ethers.BigNumber.from('2000000000000000000') // 2 eth for 1000$ is minOut, too much
                    });

                    const tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);
                    await expect(
                        _swapMain.executeMessageWithTransfer(
                            ethers.constants.AddressZero,
                            transitToken.address,
                            DEFAULT_AMOUNT_IN,
                            DST_CHAIN_ID,
                            message,
                            EXECUTOR_ADDRESS
                        )
                    ).to.emit(swapMain, 'SwapRequestDone');

                    const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);

                    // take only platform comission in transit token
                    await expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.eq(
                        DEFAULT_AMOUNT_IN.mul(BN.from(feeDecimals).sub(platformFee)).div(
                            feeDecimals
                        )
                    );

                    const collectedFee1 = await swapMain.availableRubicFee(transitToken.address);

                    await expect(collectedFee1).to.be.eq(
                        DEFAULT_AMOUNT_IN.mul(platformFee).div(feeDecimals)
                    );
                    const integratorCollectedFee1 = await swapMain.availableIntegratorFee(
                        INTEGRATOR,
                        transitToken.address
                    );
                    await expect(Number(integratorCollectedFee1)).to.be.eq(0);
                });

                describe('target swap should take integrator & rubic fee', async () => {
                    let integratorFee;
                    let platformShare;
                    let integratorPart;
                    beforeEach('set integrator and rubic fee', async () => {
                        await swapMain.setIntegratorFee(INTEGRATOR, '3000', '500000'); // 0.3 %

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [transitToken.address, swapToken.address],
                            integrator: INTEGRATOR,
                            amountOutMinimum: ethers.BigNumber.from('200000000000000000') // 0.2 eth for 1000$ is minOut, too much
                        });

                        integratorFee = await swapMain.integratorFee(INTEGRATOR);
                        platformShare = await swapMain.platformShare(INTEGRATOR);
                        integratorPart = integratorFee
                            .mul(BN.from(feeDecimals).sub(platformShare))
                            .div(feeDecimals);
                        platformFee = integratorFee
                            .mul(await swapMain.platformShare(INTEGRATOR))
                            .div(feeDecimals);
                    });

                    it('should successfully swapV2 token to token with rubic & integrator fee', async () => {
                        await hre.network.provider.request({
                            method: 'hardhat_impersonateAccount',
                            params: [TEST_BUS]
                        });

                        const bus = await ethers.getSigner(TEST_BUS);

                        await network.provider.send('hardhat_setBalance', [
                            bus.address,
                            '0x152D02C7E14AF6800000' // 100000 eth
                        ]);

                        const _swapMain = swapMain.connect(bus);

                        let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);
                        await expect(
                            _swapMain.executeMessageWithTransfer(
                                ethers.constants.AddressZero,
                                transitToken.address,
                                DEFAULT_AMOUNT_IN,
                                DST_CHAIN_ID,
                                message,
                                EXECUTOR_ADDRESS
                            )
                        ).to.emit(swapMain, 'SwapRequestDone');
                        const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                        const collectedFee1 = await swapMain.availableRubicFee(
                            transitToken.address
                        );
                        const integratorCollectedFee1 = await swapMain.availableIntegratorFee(
                            transitToken.address,
                            INTEGRATOR
                        );

                        await expect(integratorCollectedFee1).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(integratorPart).div(feeDecimals)
                        );
                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(platformFee).div(feeDecimals)
                        );

                        await expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(feeDecimals.sub(integratorFee)).div(feeDecimals)
                        );
                    });

                    it('should successfully swapV2 token to native with rubic & integrator fee', async () => {
                        await hre.network.provider.request({
                            method: 'hardhat_impersonateAccount',
                            params: [TEST_BUS]
                        });

                        const bus = await ethers.getSigner(TEST_BUS);

                        await network.provider.send('hardhat_setBalance', [
                            bus.address,
                            '0x152D02C7E14AF6800000' // 100000 eth
                        ]);

                        const _swapMain = swapMain.connect(bus);

                        let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [transitToken.address, wnative.address],
                            integrator: INTEGRATOR,
                            amountOutMinimum: ethers.BigNumber.from('20000000000000000') // 0.02 eth for 1000$ is minOut
                        });

                        await expect(
                            _swapMain.executeMessageWithTransfer(
                                ethers.constants.AddressZero,
                                transitToken.address,
                                DEFAULT_AMOUNT_IN,
                                DST_CHAIN_ID,
                                message,
                                EXECUTOR_ADDRESS
                            )
                        ).to.emit(swapMain, 'SwapRequestDone');

                        const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                        const collectedFee1 = await swapMain.availableRubicFee(
                            transitToken.address
                        );
                        const integratorCollectedFee1 = await swapMain.availableIntegratorFee(
                            transitToken.address,
                            INTEGRATOR
                        );

                        await expect(integratorCollectedFee1).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(integratorPart).div(feeDecimals)
                        );
                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(platformFee).div(feeDecimals)
                        );

                        await expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(feeDecimals.sub(integratorFee)).div(feeDecimals)
                        );
                    });

                    it('should fail swap V2 with rubic & integrator fee', async () => {
                        await hre.network.provider.request({
                            method: 'hardhat_impersonateAccount',
                            params: [TEST_BUS]
                        });

                        const bus = await ethers.getSigner(TEST_BUS);

                        await network.provider.send('hardhat_setBalance', [
                            bus.address,
                            '0x152D02C7E14AF6800000' // 100000 eth
                        ]);

                        const _swapMain = swapMain.connect(bus);

                        let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [transitToken.address, swapToken.address],
                            integrator: INTEGRATOR,
                            amountOutMinimum: ethers.BigNumber.from('20000000000000000000') // 20 eth for 1000$ is min out
                        });
                        await expect(
                            _swapMain.executeMessageWithTransfer(
                                ethers.constants.AddressZero,
                                transitToken.address,
                                DEFAULT_AMOUNT_IN,
                                DST_CHAIN_ID,
                                message,
                                EXECUTOR_ADDRESS
                            )
                        ).to.emit(swapMain, 'SwapRequestDone');
                        const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                        const collectedFee1 = await swapMain.availableRubicFee(
                            transitToken.address
                        );
                        const integratorCollectedFee1 = await swapMain.availableIntegratorFee(
                            transitToken.address,
                            INTEGRATOR
                        );

                        await expect(integratorCollectedFee1).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(integratorPart).div(feeDecimals)
                        );
                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(platformFee).div(feeDecimals)
                        );

                        await expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.eq(
                            DEFAULT_AMOUNT_IN.mul(feeDecimals.sub(integratorFee)).div(feeDecimals)
                        );
                    });
                });
            });
            describe('Kephi integration', () => {
                it.only('should buy nft on Kephi', async () => {
                    await swapMain.setMPRegistry(3, '0xEca42E21C0D44a7Df04F1f0177C321a123eA9B14');

                    const KephiExchange = IKephiExchange__factory.connect(
                        ethers.constants.AddressZero,
                        wallet
                    );
                    const data = KephiExchange.interface.encodeFunctionData('makeExchangeERC721', [
                        '0xdd522e4c2b957b22bfe8ed25ef5cb24ad351fd791c52c68a9c5c786c81e1adc3',
                        [
                            '0x8318958F4f8b90bf8e3a50927c94632d3715142A',
                            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
                        ],
                        {
                            tokenAddress: '0x5f46c23ed76cD1e05B46DeCCeda5F407D1D3e66b',
                            id: 1,
                            amount: 0
                        },
                        {
                            tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                            id: 0,
                            amount: '560000000000000000'
                        },
                        [
                            '0x8318958F4f8b90bf8e3a50927c94632d3715142A',
                            '0x1ddd5F5c93acC898C1Da11FA00e3E07c480925F5'
                        ],
                        ['56000000000000000', '28000000000000000'],
                        '0x10fb3585a17e26eb14bf5b3069460dee80ef85ae6712526907559a4b56bc0fde1bf44f75a6780decf57bcc71ac4e9328bdf22a9b59fa331f37a1ce3cbf962bf81c'
                    ]);

                    const message = await getMessage(
                        testMessagesContract,
                        (await swapMain.nonce()).add('1'),
                        DST_CHAIN_ID,
                        {
                            path: [transitToken.address, wnative.address],
                            amountOutMinimum: ethers.BigNumber.from('200000000000000000'), // 0.2 eth for 1000$ is min,
                            marketID: 3,
                            value: BN.from('560000000000000000'),
                            data
                        }
                    );

                    await hre.network.provider.request({
                        method: 'hardhat_impersonateAccount',
                        params: [TEST_BUS]
                    });

                    const bus = await ethers.getSigner(TEST_BUS);

                    await network.provider.send('hardhat_setBalance', [
                        bus.address,
                        '0x152D02C7E14AF6800000' // 100000 eth
                    ]);

                    const _swapMain = swapMain.connect(bus);

                    await expect(
                        _swapMain.executeMessageWithTransfer(
                            ethers.constants.AddressZero,
                            transitToken.address,
                            ethers.utils.parseEther('1000'),
                            DST_CHAIN_ID,
                            message,
                            EXECUTOR_ADDRESS
                        )
                    )
                        .to.emit(_swapMain, 'NFTPurchased')
                        .withArgs(3, BN.from('560000000000000000'));
                });
            });
        });
    });
});
