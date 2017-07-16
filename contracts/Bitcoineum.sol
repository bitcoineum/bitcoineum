pragma solidity ^0.4.13;

import './ERC20Mineable.sol';
import './Transmutable.sol';

/**
 * @title Bitcoineum: A store of value on the Ethereum network
 * @dev A coin designed to create store-of-value semantics
 */


contract Bitcoineum is ERC20Mineable, Transmutable {

 string public constant name = "Bitcoineum";
 string public constant symbol = "BTE";
 uint256 public constant decimals = 8;
 uint256 public constant INITIAL_SUPPLY = 0;

 // 21 Million coins at 8 decimal places
 uint256 public constant MAX_SUPPLY = 21000000 * (10**8);
 
 function Bitcoineum() {

    totalSupply = INITIAL_SUPPLY;
    maximumSupply = MAX_SUPPLY;

    // 0.0001 Ether per block
    // Difficulty is so low because it doesn't include
    // gas prices for execution
    currentDifficultyWei = 100 szabo;
    minimumDifficultyThresholdWei = 100 szabo;
    
    // Ethereum blocks to internal blocks
    blockCreationRate = 10;

    // Adjust difficulty x claimed internal blocks
    difficultyAdjustmentPeriod = 2016;

    // Reward adjustment

    rewardAdjustmentPeriod = 210000;

    // This is the effective block counter, since block windows are discontinuous
    totalBlocksMined = 0;

    totalWeiExpected = difficultyAdjustmentPeriod * currentDifficultyWei;

    // Balance of this address can be used to determine total burned value
    // not including fees spent.
    burnAddress = 0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD;

    lastDifficultyAdjustmentEthereumBlock = block.number; 
 }


   /**
   * @dev Bitcoineum can extend proof of burn into convertable units
   * that have token specific properties
   * @param to is the address of the contract that Bitcoineum is converting into
   * @param value is the quantity of Bitcoineum to attempt to convert
   */

  function transmute(address to, uint256 value) nonReentrant returns (bool, uint256) {
    require(value > 0);
    require(balances[msg.sender] >= value);
    uint256 initial_total_supply = totalSupply;
    uint256 initial_balance = balances[msg.sender];
    balances[msg.sender].sub(value);
    totalSupply.sub(value);
    TransmutableInterface target = TransmutableInterface(to);
    bool result = false;
    uint256 total = 0;
    (result, total) = target.transmuted(value);
    if (result) {
       Transmuted(msg.sender, this, to, value, total);
    } else {
      // The transmuted transaction failed, restore balance
      totalSupply = initial_total_supply;
      balances[msg.sender] = initial_balance;
    }
  }

 }
