require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");
require("@nomicfoundation/hardhat-chai-matchers");
// import "@nomicfoundation/hardhat-toolbox";
// import "solidity-coverage";
// import "@nomicfoundation/hardhat-chai-matchers";


module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.27", // Match contracts/Lock.sol
      },
      {
        version: "0.8.20", // Match OpenZeppelin contracts
      },
    ],
  },
};