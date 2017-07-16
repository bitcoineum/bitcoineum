pragma solidity ^0.4.13;

import '../../contracts/Transmutable.sol';

contract GoldMock is TransmutableInterface {
  uint256 public total = 0;

  function transmuted(uint256 _value) returns (bool, uint256) {
      total += _value;
      return (true, _value);
  }

}


