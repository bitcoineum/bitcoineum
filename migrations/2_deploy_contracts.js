var Bitcoineum = artifacts.require("./Bitcoineum.sol");

module.exports = function(deployer) {
  deployer.deploy(Bitcoineum);
};
