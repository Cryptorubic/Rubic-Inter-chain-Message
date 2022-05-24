const hre = require("hardhat");

async function main() {
  const CrossChainSwap = await hre.ethers.getContractFactory("RubicRouterV2ETH");
  /*
   * constructor
   *    address _messageBus,
   *    address[] memory _supportedDEXes,
   *    address _nativeWrap
   */

  // ETH Aurora 1313161554
  // MessageBus 0xc1a2D967DfAa6A10f3461bc21864C23C1DD51EeA
  // ETH native token address : 0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB
  // USDC token address: 0xB12BFcA5A55806AaF64E99521918A4bf0fC40802
  // SUSHI:

  const CrossChainSwapDeploy = await CrossChainSwap.deploy(
        '0xc1a2D967DfAa6A10f3461bc21864C23C1DD51EeA',
      ['0x2CB45Edb4517d5947aFdE3BEAbF95A582506858B','0xa3a1eF5Ae6561572023363862e238aFA84C72ef5'],
      '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB'
  );

  await CrossChainSwapDeploy.deployed();

  console.log("CrossChainSwapDeploy deployed to:", CrossChainSwapDeploy.address);
  await new Promise(r => setTimeout(r, 10000));

  await hre.run("verify:verify", {
    address: CrossChainSwapDeploy.address,
    constructorArguments: [
      '0xc1a2D967DfAa6A10f3461bc21864C23C1DD51EeA',
      ['0x2CB45Edb4517d5947aFdE3BEAbF95A582506858B','0xa3a1eF5Ae6561572023363862e238aFA84C72ef5'],
      '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB'
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
