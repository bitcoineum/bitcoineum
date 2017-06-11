pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/Bitcoineum.sol";

contract TestBitcoineum {

  function testParametersUsingDeployedContract() {
    Bitcoineum bte = Bitcoineum(DeployedAddresses.Bitcoineum());
    Assert.equal(bte.blockNumber(), 1, "Block number should start at 1");
  }

  function testParametersWithNewBitcoineum() {
    Bitcoineum bte = new Bitcoineum();

    Assert.equal(bte.blockNumber(), 1, "Block number should start at 1");
  }

}
