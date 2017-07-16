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

  // We can play with forced difficulty adjustments
  // by playing with the totalWeiCommitted in a block period
  // or artificially inflating totalWeiExpected to a specific difficulty

  function set_total_wei_committed(uint256 _wei) {
     totalWeiCommitted = _wei;
  }

  function set_total_wei_expected(uint256 _wei) {
     totalWeiExpected = _wei;
  }

  function set_current_difficulty(uint256 _wei) {
     currentDifficultyWei = _wei;
  }

  function set_balance(address _user, uint256 _value) {
      balances[_user] = _value;
  }

  function resolve_block_hash(uint256 _blockNum) public constant returns (bytes32) {
   _blockNum = 0; // suppress warning
    return current_block_hash;
  }

}


