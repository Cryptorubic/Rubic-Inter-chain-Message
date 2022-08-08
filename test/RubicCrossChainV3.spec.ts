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
    VERSION_V3,
    ZERO_ADDRESS,
    DEFAULT_AMOUNT_OUT_MIN,
    EXECUTOR_ADDRESS,
    INTEGRATOR,
    MESSAGE_BUS_FEE
} from './shared/consts';
import { BigNumber as BN, BigNumberish, ContractTransaction, BytesLike } from 'ethers';
import { calcCryptoFees, calcTokenFees } from 'rubic-bridge-base/lib';
// import { getRouterV3 } from './shared/utils';
const hre = require('hardhat');

const createFixtureLoader = waffle.createFixtureLoader;

const envConfig = require('dotenv').config();
const {
    ROUTERS_POLYGON: TEST_ROUTERS,
    NATIVE_POLYGON: TEST_NATIVE,
    BUS_POLYGON_MAIN: TEST_BUS
} = envConfig.parsed || {};

describe('RubicCrossChainV3', () => {
    let wallet: Wallet, other: Wallet;
    let swapToken: TestERC20;
    let transitToken: TestERC20;
    let swapMain: RubicRouterV2;
    let router: string;
    let routerV3: string;
    let wnative: WETH9;

    let testMessagesContract: TestMessages;

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    // async function toBytes32(address): Promise<string> {
    //     return '0x000000000000000000000000' + address.slice(2, address.length);
    // }

    async function encodePath(tokens): Promise<string> {
        return tokens[0] + '000bb8' + tokens[1].slice(2);
    }

    // function encodePathReverse(tokens){
    //     const zeros = '0'.repeat(24)
    //     return (tokens[1] + '000bb8' + tokens[0].slice(2))
    // }

    async function callTransferWithSwapV3Native(
        amountOutMinimum: BigNumberish,
        srcPathBytes: BytesLike,
        {
            receiver = null,
            amountIn = DEFAULT_AMOUNT_IN,
            dstChainID = DST_CHAIN_ID,
            srcDEX = routerV3,
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

        return swapMain.transferWithSwapV3Native(
            receiver === null ? wallet.address : receiver,
            amountIn,
            dstChainID,
            {
                dex: srcDEX,
                path: srcPathBytes,
                deadline: DEADLINE,
                amountOutMinimum
            },
            {
                dex: routerV3,
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

    async function callTransferWithSwapV3(
        amountOutMinimum: BigNumberish,
        srcPathBytes: BytesLike,
        {
            receiver = null,
            amountIn = DEFAULT_AMOUNT_IN,
            dstChainID = DST_CHAIN_ID,
            srcDEX = routerV3,
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

        return swapMain.transferWithSwapV3(
            receiver === null ? wallet.address : receiver,
            amountIn,
            dstChainID,
            {
                dex: srcDEX,
                path: srcPathBytes,
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

    // async function getAmountOutMinV3(
    //     amountIn = DEFAULT_AMOUNT_IN,
    //     path = [swapToken.address, transitToken.address]
    // ): Promise<BN> {
    //     const _path = pack(['address', 'uint24', 'address'], [path[0], FeeAmount.LOW, path[1]]);
    //     return quoter.callStatic.quoteExactInput(_path, amountIn);
    // }

    async function getMessage(
        messagesContract: TestMessages,
        _nonce: BigNumberish,
        dstChainId: BigNumberish,
        {
            dex = routerV3,
            receiverEOA = other.address,
            integrator = ethers.constants.AddressZero,
            version = VERSION_V3,
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
                receiverEOA,
                nativeOut,
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
    //         dex = routerV3,
    //         receiverEOA = other.address,
    //         integrator = INTEGRATOR,
    //         version = VERSION_V3,
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
        ({ swapMain, swapToken, transitToken, wnative, router, routerV3, testMessagesContract } =
            await loadFixture(swapContractFixtureInFork));
    });

    it('constructor initializes', async () => {
        expect(await swapMain.nativeWrap()).to.eq(TEST_NATIVE);
        expect(await swapMain.messageBus()).to.eq(TEST_BUS);

        const routers = TEST_ROUTERS.split(',');
        expect(await swapMain.getAvailableRouters()).to.deep.eq(routers);
    });

    describe('#WithSwapTests', () => {
        describe('#transferWithSwapV3Native', () => {
            it('Should swap native and transfer through Celer', async () => {
                //const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('1000')
                );

                const path = await encodePath([wnative.address, transitToken.address]);
                const _amountIn = ethers.BigNumber.from('20000000000000000000');

                await expect(
                    callTransferWithSwapV3Native(0, path, {
                        amountIn: _amountIn
                    })
                ).to.emit(swapMain, 'CrossChainRequestSent');
                //.withArgs(ID, DST_CHAIN_ID, _amountIn, wnative.address);
            });
            it('Should fail transfer through Celer', async () => {
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('1000')
                );

                const path = await encodePath([wnative.address, transitToken.address]);

                await expect(callTransferWithSwapV3Native(0, path)).to.be.revertedWith(
                    'amount too small'
                );
            });
        });
        describe('#transferWithSwapV3', () => {
            it('Should swap transitToken and transfer through Сeler', async () => {
                await swapToken.approve(swapMain.address, ethers.constants.MaxUint256);
                await swapMain.setMaxTokenAmount(
                    transitToken.address,
                    ethers.utils.parseEther('1000')
                );
                // const ID = await getID(testMessagesContract, (await swapMain.nonce()).add('1'));

                const path = await encodePath([swapToken.address, transitToken.address]);

                await expect(callTransferWithSwapV3(0, path)).to.emit(
                    swapMain,
                    'CrossChainRequestSent'
                );
                // .withArgs(ID, DST_CHAIN_ID, DEFAULT_AMOUNT_IN, swapToken.address);
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

                    const pathV3 = await encodePath([transitToken.address, swapToken.address]);

                    message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                        path: [ZERO_ADDRESS],
                        pathV3: pathV3,
                        amountOutMinimum: ethers.BigNumber.from('0')
                    });
                });
                it('should successfully swap V3 with rubic fee', async () => {
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
                    // take only platform comission in transit token
                    const { feeAmount } = await calcTokenFees({
                        bridge: swapMain,
                        amountWithFee: ethers.BigNumber.from('1000000000')
                    });
                    // take only platform comission in transit token
                    await expect(tokenBalanceAfter).to.be.eq(feeAmount);
                });

                it('should fail swap V3 with rubic fee and transfer tokens', async () => {
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
                    const pathV3 = await encodePath([transitToken.address, wnative.address]);

                    message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                        path: [ZERO_ADDRESS],
                        pathV3: pathV3,
                        amountOutMinimum: ethers.BigNumber.from('2000000000000000000') // 2 eth for 1000$ is minOut, too much
                    });

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

                    const { RubicFee, feeAmount } = await calcTokenFees({
                        bridge: swapMain,
                        amountWithFee: ethers.BigNumber.from('1000000000')
                        //integrator: INTEGRATOR,
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
                        });

                        const pathV3 = await encodePath([transitToken.address, swapToken.address]);

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [ZERO_ADDRESS],
                            integrator: INTEGRATOR,
                            pathV3: pathV3,
                            amountOutMinimum: ethers.BigNumber.from('0')
                        });
                    });
                    it('should successfully swap V3 with rubic & integrator fee', async () => {
                        await hre.network.provider.request({
                            method: 'hardhat_impersonateAccount',
                            params: [TEST_BUS]
                        });

                        const bus = await ethers.getSigner(TEST_BUS);

                        await network.provider.send('hardhat_setBalance', [
                            bus.address,
                            '0x152D02C7E14AF6800000'
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
                            integrator: INTEGRATOR
                        });

                        await expect(integratorCollectedFee1).to.be.eq(integratorFee);

                        // take platform comission in transit token
                        await expect(collectedFee1).to.be.eq(RubicFee);

                        await expect(tokenBalanceAfter).to.be.eq(feeAmount);
                    });
                    it('should fail swap V3 with rubic & integrator fee', async () => {
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

                        const pathV3 = await encodePath([transitToken.address, swapToken.address]);

                        message = await getMessage(testMessagesContract, nonce, DST_CHAIN_ID, {
                            path: [ZERO_ADDRESS],
                            integrator: INTEGRATOR,
                            pathV3: pathV3,
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
                            integrator: INTEGRATOR
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
