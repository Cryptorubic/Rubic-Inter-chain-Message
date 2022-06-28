const hre = require("hardhat");

async function main() {
  const CrossChainSwap = await hre.ethers.getContractFactory("RubicRouterV2");
  /*
   * constructor
   *    address _messageBus,
   *    address[] memory _supportedDEXes,
   *    address _nativeWrap
   */

  // MATIC Polygon 137
  // MessageBus 0xaFDb9C40C7144022811F034EE07Ce2E110093fe6
  // MATIC native token address in BSC: 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
  // USDC token address in BSC: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
  // SUSHI: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506

  const CrossChainSwapDeploy = await CrossChainSwap.deploy(
      [],
      [],
      [],
      [],
      [],
      [],
      ['0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff','0xE592427A0AEce92De3Edee1F18E0157C05861564','0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506','0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607','0x1111111254fb6c44bAC0beD2854e76F90643097d','0x89D6B81A1Ef25894620D05ba843d83B0A296239e'],
      '0xfe99d38697e107FDAc6e4bFEf876564f70041594',
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      '0xaFDb9C40C7144022811F034EE07Ce2E110093fe6',
  );

  await CrossChainSwapDeploy.deployed();

  console.log("CrossChainSwapDeploy deployed to:", CrossChainSwapDeploy.address);
  await new Promise(r => setTimeout(r, 10000));

  await hre.run("verify:verify", {
    address: CrossChainSwapDeploy.address,
    constructorArguments: [
      [],
      [],
      [],
      [],
      [],
      [],
      ['0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff','0xE592427A0AEce92De3Edee1F18E0157C05861564','0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506','0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607','0x1111111254fb6c44bAC0beD2854e76F90643097d','0x89D6B81A1Ef25894620D05ba843d83B0A296239e'],
      '0xfe99d38697e107FDAc6e4bFEf876564f70041594',
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      '0xaFDb9C40C7144022811F034EE07Ce2E110093fe6',
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
