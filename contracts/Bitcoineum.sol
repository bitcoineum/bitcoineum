pragma solidity ^0.4.13;

import './ERC20Mineable.sol';

/**
 * @title Bitcoineum: A store of value on the Ethereum network
 * @dev A coin designed to create store-of-value semantics
 */


contract Bitcoineum is ERC20Mineable {

 string public constant name = "Bitcoineum";
 string public constant symbol = "BTE";
 uint public constant decimals = 8;
 uint public constant INITIAL_SUPPLY = 0;

 // 21 Million coins at 8 decimal places
 uint public constant MAX_SUPPLY = 21000000 * (10**8);
 
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
    genesisBlock = block.number;
 }

 }
