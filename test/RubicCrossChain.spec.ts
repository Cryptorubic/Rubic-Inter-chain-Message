import {ethers, network, waffle} from 'hardhat';
import {swapContractFixtureInFork} from './shared/fixtures';
import {Wallet} from '@ethersproject/wallet';
import {SwapMain, TestERC20, WETH9} from '../typechain-types';
import {expect} from 'chai';
import {AbiCoder} from '@ethersproject/abi';
import {deadline} from './shared/consts';
import {BigNumberish, ContractTransaction} from 'ethers';
import {getRouterV2} from './shared/utils';

const createFixtureLoader = waffle.createFixtureLoader;

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
        { receiver, amountIn, cBridgePart, dstChainID, srcDEX, srcPath, nativeOut, nativeIn } = {
            receiver: null,
            amountIn: ethers.utils.parseEther('1'),
            cBridgePart: '0',
            dstChainID: 5,
            srcDEX: router,
            srcPath: [wnative.address, token.address],
            nativeOut: false,
            nativeIn: null
        }
    ) {
        const cryptoFee = await swapMain.dstCryptoFee(dstChainID);

        const tx = await swapMain.transferWithSwapV2Native(
            receiver === null ? await swapMain.signer.getAddress() : receiver,
            amountIn,
            cBridgePart,
            dstChainID,
            {
                dex: srcDEX,
                path: srcPath,
                deadline,
                amountOutMinimum
            },
            {
                dex: router,
                version: 1,
                path: [wnative.address, token.address],
                dataInchOrPathV3: '0x',
                deadline,
                amountOutMinimum: ethers.utils.parseEther('10')
            },
            '10',
            nativeOut,
            { value: nativeIn === null ? amountIn.add(cryptoFee) : nativeIn }
        );

        return tx;
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
        it.only('transferWithSwapV2Native', async () => {
            const routerV2 = await getRouterV2(wallet, router);

            const amountOutMin = (
                await routerV2.getAmountsOut(ethers.utils.parseEther('1'), [
                    wnative.address,
                    token.address
                ])
            )[1];

            await expect(callTransferWithSwapV2Native(amountOutMin)).to.emit(
                swapMain.address,
                'TransferTokensToOtherBlockchainUser'
            );
            expect(await token.balanceOf(swapMain.address)).to.be.eq(amountOutMin);
        });
    });
});
