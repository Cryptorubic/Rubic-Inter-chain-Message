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
    DEFAULT_AMOUNT_IN_USDC,
    MESSAGE_BUS_FEE
} from './shared/consts';
import { BigNumber as BN, BigNumberish, ContractTransaction } from 'ethers';
import { getRouterV2 } from './shared/utils';
import { calcCryptoFees, calcTokenFees } from 'rubic-bridge-base/lib';
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
        const { totalCryptoFee } = await calcCryptoFees({
            bridge: swapMain,
            integrator,
            dstChainID
        });

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
                receiverEOA: other.address,
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
                    nativeIn === null ? amountIn.add(totalCryptoFee).add(MESSAGE_BUS_FEE) : nativeIn
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
        const { totalCryptoFee } = await calcCryptoFees({
            bridge: swapMain,
            integrator,
            dstChainID
        });

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
                receiverEOA: other.address,
                integrator: integrator,
                version: VERSION_V2,
                path: [wnative.address, transitToken.address],
                pathV3: '0x',
                deadline: DEADLINE,
                amountOutMinimum: DEFAULT_AMOUNT_OUT_MIN
            },
            '10000',
            { value: nativeIn === null ? totalCryptoFee.add(MESSAGE_BUS_FEE) : nativeIn }
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
            receiverEOA = other.address,
            integrator = ethers.constants.AddressZero,
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
                receiverEOA,
                integrator,
                version,
                path,
                pathV3,
                deadline,
                amountOutMinimum
            },
            _nonce,
            dstChainId
        );
    }

    // async function getID(
    //     messagesContract: TestMessages,
    //     _nonce: BigNumberish,
    //     {
    //         dex = router,
    //         receiverEOA = other.address,
    //         integrator = INTEGRATOR,
    //         version = VERSION_V2,
    //         path = [wnative.address, transitToken.address],
    //         pathV3 = '0x',
    //         deadline = DEADLINE,
    //         amountOutMinimum = DEFAULT_AMOUNT_OUT_MIN,
    //         _receiver = wallet.address,
    //         nativeOut = true,
    //         _srcChainId = chainId,
    //         _dstChainId = DST_CHAIN_ID
    //     } = {}
    // ): Promise<string> {
    //     return messagesContract.getID(
    //         _srcChainId,
    //         _dstChainId,
    //         {
    //             dex,
    //             nativeOut,
    //             receiverEOA,
    //             integrator,
    //             version,
    //             path,
    //             pathV3,
    //             deadline,
    //             amountOutMinimum
    //         },
    //         _nonce
    //     );
    // }

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
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
                    ethers.utils.parseEther('1000')
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
                ).to.emit(swapMain, 'CrossChainRequestSent');
            });
            it('Should swap native to token and fail transfer through Celer', async () => {
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('1000')
                );

                const amountOutMin = await getAmountOutMin();

                await expect(
                    callTransferWithSwapV2Native(amountOutMin, {
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
                    ethers.utils.parseEther('1000')
                );

                const amountOutMin = await getAmountOutMin(DEFAULT_AMOUNT_IN, [
                    swapToken.address,
                    transitToken.address
                ]);

                //const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));
                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, transitToken.address]
                    })
                ).to.emit(swapMain, 'CrossChainRequestSent');
                //.withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, swapToken.address);
            });

            it('Should swap token to native and transfer through Сeler', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);
                await swapMain.setMaxTokenAmount(wnative.address, ethers.utils.parseEther('10000'));

                // amountIn is 100$
                const amountOutMin = await getAmountOutMin(DEFAULT_AMOUNT_IN_USDC, [
                    swapToken.address,
                    wnative.address
                ]);

                //const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));

                await expect(
                    callTransferWithSwapV2(amountOutMin, {
                        srcPath: [swapToken.address, wnative.address]
                    })
                ).to.emit(swapMain, 'CrossChainRequestSent');
                //.withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, swapToken.address);
            });
        });
        describe('#executeMessageWithTransfer', () => {
            beforeEach('setup for target executions', async () => {
                // transfer 1000 USDC
                await transitToken.transfer(swapMain.address, ethers.BigNumber.from('1000000000'));
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

                    //let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);
                    await expect(
                        _swapMain.executeMessageWithTransfer(
                            ethers.constants.AddressZero,
                            transitToken.address,
                            ethers.BigNumber.from('1000000000'),
                            DST_CHAIN_ID,
                            message,
                            EXECUTOR_ADDRESS
                        )
                    ).to.emit(swapMain, 'CrossChainProcessed');
                    let tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);

                    const { feeAmount } = await calcTokenFees({
                        bridge: swapMain,
                        amountWithFee: ethers.BigNumber.from('1000000000'),
                        initChainID: DST_CHAIN_ID
                    });
                    // take only platform comission in transit token
                    await expect(Number(tokenBalanceAfter)).to.be.eq(feeAmount);
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

                    //const tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);
                    await expect(
                        _swapMain.executeMessageWithTransfer(
                            ethers.constants.AddressZero,
                            transitToken.address,
                            ethers.BigNumber.from('1000000000'),
                            DST_CHAIN_ID,
                            message,
                            EXECUTOR_ADDRESS
                        )
                    ).to.emit(swapMain, 'CrossChainProcessed');

                    const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);

                    const { RubicFee, feeAmount } = await calcTokenFees({
                        bridge: swapMain,
                        amountWithFee: ethers.BigNumber.from('1000000000'),
                        //integrator: INTEGRATOR,
                        initChainID: DST_CHAIN_ID
                    });

                    // take only platform comission in transit token
                    await expect(tokenBalanceAfter).to.be.eq(feeAmount);

                    const collectedFee1 = await swapMain.availableRubicTokenFee(
                        transitToken.address
                    );

                    await expect(collectedFee1).to.be.eq(RubicFee);

                    const integratorCollectedFee1 = await swapMain.availableIntegratorTokenFee(
                        transitToken.address,
                        INTEGRATOR
                    );
                    await expect(Number(integratorCollectedFee1)).to.be.eq(0);
                });

                describe('target swap should take integrator & rubic fee', async () => {
                    beforeEach('set integrator and rubic fee', async () => {
                        await swapMain.setIntegratorInfo(INTEGRATOR, {
                            isIntegrator: true,
                            tokenFee: '3000',
                            RubicTokenShare: '400000',
                            RubicFixedCryptoShare: '800000',
                            fixedFeeAmount: ethers.utils.parseEther('2')
                        }); // 0.3 %

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [transitToken.address, swapToken.address],
                            integrator: INTEGRATOR,
                            amountOutMinimum: ethers.BigNumber.from('200000000000000000') // 0.2 eth for 1000$ is minOut, too much
                        });
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

                        //let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);
                        await expect(
                            _swapMain.executeMessageWithTransfer(
                                ethers.constants.AddressZero,
                                transitToken.address,
                                ethers.BigNumber.from('1000000000'),
                                DST_CHAIN_ID,
                                message,
                                EXECUTOR_ADDRESS
                            )
                        ).to.emit(swapMain, 'CrossChainProcessed');
                        const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                        const collectedFee1 = await swapMain.availableRubicTokenFee(
                            transitToken.address
                        );

                        const integratorCollectedFee1 = await swapMain.availableIntegratorTokenFee(
                            transitToken.address,
                            INTEGRATOR
                        );

                        const { integratorFee, RubicFee, feeAmount } = await calcTokenFees({
                            bridge: swapMain,
                            amountWithFee: ethers.BigNumber.from('1000000000'),
                            integrator: INTEGRATOR,
                            initChainID: DST_CHAIN_ID
                        });

                        await expect(integratorCollectedFee1).to.be.eq(integratorFee);

                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(RubicFee);

                        await expect(tokenBalanceAfter).to.be.eq(feeAmount);
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

                        //let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [transitToken.address, wnative.address],
                            integrator: INTEGRATOR,
                            amountOutMinimum: ethers.BigNumber.from('20000000000000000') // 0.02 eth for 1000$ is minOut
                        });

                        await expect(
                            _swapMain.executeMessageWithTransfer(
                                ethers.constants.AddressZero,
                                transitToken.address,
                                ethers.BigNumber.from('1000000000'),
                                DST_CHAIN_ID,
                                message,
                                EXECUTOR_ADDRESS
                            )
                        ).to.emit(swapMain, 'CrossChainProcessed');

                        const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                        const collectedFee1 = await swapMain.availableRubicTokenFee(
                            transitToken.address
                        );

                        const integratorCollectedFee1 = await swapMain.availableIntegratorTokenFee(
                            transitToken.address,
                            INTEGRATOR
                        );

                        const { integratorFee, RubicFee, feeAmount } = await calcTokenFees({
                            bridge: swapMain,
                            amountWithFee: ethers.BigNumber.from('1000000000'),
                            integrator: INTEGRATOR,
                            initChainID: DST_CHAIN_ID
                        });

                        await expect(integratorCollectedFee1).to.be.eq(integratorFee);

                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(RubicFee);

                        await expect(tokenBalanceAfter).to.be.eq(feeAmount);
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

                        //let tokenBalanceBefore = await transitToken.balanceOf(swapMain.address);

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [transitToken.address, swapToken.address],
                            integrator: INTEGRATOR,
                            amountOutMinimum: ethers.BigNumber.from('20000000000000000000') // 20 eth for 1000$ is min out
                        });
                        await expect(
                            _swapMain.executeMessageWithTransfer(
                                ethers.constants.AddressZero,
                                transitToken.address,
                                ethers.BigNumber.from('1000000000'),
                                DST_CHAIN_ID,
                                message,
                                EXECUTOR_ADDRESS
                            )
                        ).to.emit(swapMain, 'CrossChainProcessed');
                        const tokenBalanceAfter = await transitToken.balanceOf(swapMain.address);
                        const collectedFee1 = await swapMain.availableRubicTokenFee(
                            transitToken.address
                        );

                        const integratorCollectedFee1 = await swapMain.availableIntegratorTokenFee(
                            transitToken.address,
                            INTEGRATOR
                        );

                        const { integratorFee, RubicFee, feeAmount } = await calcTokenFees({
                            bridge: swapMain,
                            amountWithFee: ethers.BigNumber.from('1000000000'),
                            integrator: INTEGRATOR,
                            initChainID: DST_CHAIN_ID
                        });

                        await expect(integratorCollectedFee1).to.be.eq(integratorFee);

                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(RubicFee);

                        await expect(tokenBalanceAfter).to.be.eq(feeAmount);
                    });
                });
            });
        });
    });
});
