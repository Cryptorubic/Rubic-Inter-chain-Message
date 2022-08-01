const hre = require('hardhat');
import { ethers } from 'hardhat';

async function main() {
    const CrossChainSwap = await hre.ethers.getContractFactory('RubicRouterV2');

    // MATIC Polygon 137
    // MessageBus 0xaFDb9C40C7144022811F034EE07Ce2E110093fe6
    // MATIC native token address in BSC: 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
    // USDC token address in BSC: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
    // SUSHI: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506

    const CrossChainSwapDeploy = await CrossChainSwap.deploy(
        ethers.utils.parseEther('1').div('100'),
        '3000', // 0.3%
        [
            '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff',
            '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
            '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607',
            '0x1111111254fb6c44bAC0beD2854e76F90643097d',
            '0x89D6B81A1Ef25894620D05ba843d83B0A296239e',
            '0xE592427A0AEce92De3Edee1F18E0157C05861564'
        ],
        ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
        ['10000000'],
        ['200000000'],
        ['56'],
        ['500'],
        '0x00009cc27c811a3e0FdD2Fd737afCc721B67eE8e',
        '0xaFDb9C40C7144022811F034EE07Ce2E110093fe6',
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    );

    await CrossChainSwapDeploy.deployed();

    console.log('CrossChainSwapDeploy deployed to:', CrossChainSwapDeploy.address);
    await new Promise(r => setTimeout(r, 10000));

    await hre.run('verify:verify', {
        address: CrossChainSwapDeploy.address,
        constructorArguments: [
            ethers.utils.parseEther('1').div('100'),
            '3000', // 0.3%
            [
                '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff',
                '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
                '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607',
                '0x1111111254fb6c44bAC0beD2854e76F90643097d',
                '0x89D6B81A1Ef25894620D05ba843d83B0A296239e',
                '0xE592427A0AEce92De3Edee1F18E0157C05861564'
            ],
            ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
            ['10000000'],
            ['200000000'],
            ['56'],
            ['500'],
            '0x00009cc27c811a3e0FdD2Fd737afCc721B67eE8e',
            '0xaFDb9C40C7144022811F034EE07Ce2E110093fe6',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
        ]
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
