pragma solidity ^0.4.11;

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
 uint public constant MAX_SUPPLY = 21000000;
 
 function Bitcoineum() {

    totalSupply = INITIAL_SUPPLY;
    maximumSupply = MAX_SUPPLY;

    // 0.001 Ether per block
    currentDifficultyWei = 100 finney;
    minimumDifficultyThresholdWei = 100 finney;
    
    // Genesis block
    blockNumber = 1;

    // Ethereum blocks to internal blocks
    blockCreationRate = 50;

    // Adjust difficulty x claimed internal blocks
    difficultyAdjustmentPeriod = 2016;

    totalBlocksMined = 1;

    totalWeiExpected = difficultyAdjustmentPeriod * currentDifficultyWei;

    burnAddress = 0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD;

    lastDifficultyAdjustmentEthereumBlock = block.number; 
 }

 }
