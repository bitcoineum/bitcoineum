pragma solidity ^0.4.13;

import '../../contracts/Transmutable.sol';

contract FoolsGoldMock is TransmutableInterface {
  uint256 total = 0;

  function transmuted(uint256 _value) returns (bool, uint256) {
      return (false, _value);
  }

}
