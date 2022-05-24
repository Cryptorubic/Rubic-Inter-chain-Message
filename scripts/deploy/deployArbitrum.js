const hre = require("hardhat");

async function main() {
  const CrossChainSwap = await hre.ethers.getContractFactory("RubicRouterV2ETH");
  /*
   * constructor
   *    address _messageBus,
   *    address[] memory _supportedDEXes,
   *    address _nativeWrap
   */

  // ETH Arbitrum 42161
  // MessageBus 0x3Ad9d0648CDAA2426331e894e980D0a5Ed16257f
  // ETH native token address in ARBITRUM: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
  // USDC token address: 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
  // SUSHI:

  const CrossChainSwapDeploy = await CrossChainSwap.deploy(
        '0x3Ad9d0648CDAA2426331e894e980D0a5Ed16257f',
      ['0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506','0xe592427a0aece92de3edee1f18e0157c05861564','0x1111111254fb6c44bAC0beD2854e76F90643097d'],
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  );

  await CrossChainSwapDeploy.deployed();

  console.log("CrossChainSwapDeploy deployed to:", CrossChainSwapDeploy.address);
  await new Promise(r => setTimeout(r, 10000));

  await hre.run("verify:verify", {
    address: CrossChainSwapDeploy.address,
    constructorArguments: [
      '0x3Ad9d0648CDAA2426331e894e980D0a5Ed16257f',
      ['0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506','0xe592427a0aece92de3edee1f18e0157c05861564','0x1111111254fb6c44bAC0beD2854e76F90643097d'],
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
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
