const hre = require("hardhat");

async function main() {
  const CrossChainSwap = await hre.ethers.getContractFactory("RubicRouterV2");
  /*
   * constructor
   *    address _messageBus,
   *    address[] memory _supportedDEXes,
   *    address _nativeWrap
   */

  // AVALANCHE 43114
  // MessageBus 0x5a926eeeAFc4D217ADd17e9641e8cE23Cd01Ad57
  // WAVAX native token address in AVALANCHE: 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7
  // USDC token address in AVALANCHE: 0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664
  // SUSHI: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506

    const CrossChainSwapDeploy = await hre.upgrades.deployProxy(
      CrossChainSwap,
      ['0x5a926eeeAFc4D217ADd17e9641e8cE23Cd01Ad57',
      ['0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'],
      '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'],
      {
          initializer: 'initialize'
      }
  );

  await CrossChainSwapDeploy.deployed();

  console.log("CrossChainSwapDeploy deployed to:", CrossChainSwapDeploy.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });