pragma solidity ^0.4.13;

import '../../contracts/Bitcoineum.sol';

/**
 * @title Bitcoineum Mocking framework
 * @dev exposes functionality for tests
 * @dev specifically playing with block advancement
 */


contract BitcoineumMock is Bitcoineum {

  uint256 current_block;


  function current_external_block() public constant returns (uint256) {
     return current_block;
  }

  function set_block(uint256 _blockNumber) {
     current_block = _blockNumber;
  }

}


