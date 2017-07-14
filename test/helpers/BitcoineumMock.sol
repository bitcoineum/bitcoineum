pragma solidity ^0.4.13;

import '../../contracts/Bitcoineum.sol';

/**
 * @title Bitcoineum Mocking framework
 * @dev exposes functionality for tests
 * @dev specifically playing with block advancement
 */


contract BitcoineumMock is Bitcoineum {

  uint256 current_block = 1;
  bytes32 current_block_hash = 0x10fa27b0a1a8efd9cf1398e2e80d3e32840acca84b09bf2b566ca14bdfa17862;

  function current_external_block() public constant returns (uint256) {
     return current_block;
  }

  function set_block(uint256 _blockNumber) {
     current_block = _blockNumber;
  }

  function set_total_supply(uint256 _supply) {
     totalSupply = _supply;
  }

  // This let's us test reward calculation from
  // within the reward claim process
  function set_blocks_mined(uint256 _blocksMined) {
     totalBlocksMined = _blocksMined;
  }

  function resolve_block_hash(uint256 _blockNum) public constant returns (bytes32) {
    return current_block_hash;
  }

}


