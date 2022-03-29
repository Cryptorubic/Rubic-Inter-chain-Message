require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require('hardhat-contract-sizer');

// Remember to add your RPC provider URL for Goerli and populate the accounts
// arrays with your testing private key.
module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 900
      }
    }
  },
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/`,
    },
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: true,
    runOnCompile: false,
  },
};
