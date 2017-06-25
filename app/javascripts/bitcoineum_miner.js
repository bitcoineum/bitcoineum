/*
 * Bitcoineum Miner
 * Copyright 2017, the Bitcoineum Development team
 * Mining interface to Ethereum smart contract
 *
 */

'use strict';

import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'
import EthereumBlocks from 'ethereum-blocks'
import BigNumber from 'bignumber.js'

import bitcoineum_artifacts from '../../build/contracts/Bitcoineum.json'

class BitcoineumBlock {

	constructor(miner, 
		        blockTargetDifficultyWei,
		        blockTotalMiningWei,
		        blockCurrentAttemptOffset,
		        blockMiningAttempted) {
		        	
		        	this.miner = miner;
		            this.blockNumber = miner.blockNumber;
		            this.reward = miner.calculateMiningReward();
		            this.payed = false;
		            this.payee = null;
		    		if (arguments.length == 1) {
		    			this.targetDifficultyWei = miner.currentDifficultyWei;
		                this.totalMiningWei = 0;
		                this.totaMiningAttempts = 0;
		                this.miningAttempted = false;
		            } else {
		            	this.targetDifficultyWei = blockTargetDifficultyWei;
		            	this.totalMiningWei = blockTotalMiningWei;
		            	this.totaMiningAttempts = blockCurrentAttemptOffset;
		            	this.miningAttempted = blockMiningAttempted;
		            }
	}

}

class BitcoineumMiner {

	constructor(miningAccount) {
		console.log("Initializing Bitcoineum Miner...");
		this.bitcoineum_contract = contract(bitcoineum_artifacts);
		this.bitcoineum_contract.setProvider(web3.currentProvider);
		this.mining_account = miningAccount;

		this.tracked_blocks = {};
		this.pending_won_blocks = [];
		this.lost_blocks = [];

		this.external_block = null;

		this.currentDifficultyWei = null; 
		this.minimumDifficultyThresholdWei = null; 
		this.blockNumber = null;
		this.blockCreationRate = null;
		this.difficultyAdjustmentPeriod = null; 
		this.rewardAdjustmentPeriod = null;
		this.lastDifficultyAdjustmentEthereumBlock = null; 
		this.totalBlocksMined = null; 
		this.totalWeiCommitted = null; 
		this.totalWeiExpected = null; 

		// Let's initialize after the node is done syncing
		// and set up callbacks

		this.waitForSync();

		this.syncStatusChange();

	}

	waitForSync() {
		var self = this;
		console.log("Waiting for sync...");
        web3.eth.getSyncing(function(error, sync){
            if(!error) {
                if(sync === true) {
                   web3.reset(true);
                } else if(sync) {
                   console.log("Syncing: " + sync.startingBlock + " => " + sync.currentBlock + " => " + sync.highestBlock);
                   setTimeout(function() {
                   	   self.waitForSync();
				   }, 2500)
                } else {
                	web3.eth.getBlock('latest', function(err, Block) {
                		if (err != null) {
							console.log("There was an error getting the latest block");
							console.log("Try reloading");
							console.log(err);
							return;
						} else {
                			self.initializeState(Block.number);
						}
					});
                }
            } else {
            	 console.log(error);
		    }
        });
	}

	syncStatusChange() {
		var self = this;
		web3.eth.isSyncing(function(Sync) {
			console.log("Syncing state transition...");
		});

	}

	initializeState(currentBlock) {
        var self = this;

        var bte;
        this.bitcoineum_contract.deployed().then(function(instance) {
        bte = instance;
        // Let's query the contract for important initial state variables
        // We will update this state as we get Events from the contract
        // that change the processing state
        return Promise.all([bte.balanceOf.call(self.mining_account,
          	                   	   {from: self.mining_account}),
          	                  bte.getContractState.call()])
        }).then(function([balance,
        	              contractState]) {

		    self.balance = balance;

			// External best block on sync
		    self.external_block = currentBlock;

		    // Break out the contract state into it's respective
		    // Variables
		    // Wei should be left as big numbers
		    self.currentDifficultyWei = contractState[0];
		    self.minimumDifficultyThresholdWei = contractState[1];

		    self.blockNumber = contractState[2].toNumber();
		    self.blockCreationRate = contractState[3].toNumber();
		    self.difficultyAdjustmentPeriod = contractState[4].toNumber();
		    self.rewardAdjustmentPeriod = contractState[5].toNumber();
		    self.lastDifficultyAdjustmentEthereumBlock = contractState[6].toNumber();
		    self.totalBlocksMined = contractState[7].toNumber();

		    // These should be left as big numbers
		    self.totalWeiCommitted = contractState[8];
		    self.totalWeiExpected = contractState[9];

	        self.printStats();
	        // Add the initial block
	        self.addInitialBlock(contractState[10],   // b.targetDifficultyWei
	        					 contractState[11],  // b.totalMiningWei
	        					 contractState[12], // b.currentAttemptOffset
	                             contractState[13]); // Did the user try to mine?

		    // Let's watch for new blocks
		    self.subscribeBlockWatching();

		    // Let's replay mining attempts
		    self.subscribeMiningAttempts(currentBlock);

		    // Let's replay mining claims
		    self.subscribeClaimEvents(currentBlock);
		 })
	}

	printStats() {
        var self = this;
		console.log("Initial Miner State");
		console.log("-------------------");
		console.log("Initial Block Number: " + self.blockNumber);
		console.log("Minimum threshold Wei: " + self.minimumDifficultyThresholdWei + " (" + web3.fromWei(self.minimumDifficultyThresholdWei, 'ether') + " ether)");
		console.log("Block creation rate: " + self.blockCreationRate);
		console.log("Difficulty adjustment period: " + self.difficultyAdjustmentPeriod);
		console.log("Last Ethereum block adjustment: " + self.lastDifficultyAdjustmentEthereumBlock);
		console.log("Total blocks mined: " + self.totalBlocksMined);
		console.log("Total wei committed for mining period: " + self.totalWeiCommitted + " (" + web3.fromWei(self.totalWeiCommitted, 'ether') + " ether)");
		console.log("Total wei expected for mining period: " + self.totalWeiExpected + " (" + web3.fromWei(self.totalWeiExpected, 'ether') + " ether)");
		console.log("-------------------");
	}


	subscribeBlockWatching() {
		var self = this;
		this.blocks = new EthereumBlocks({ web3: web3 });
        this.blocks.registerHandler('incomingBlockHandler',
        	 (eventType, blockId, data) => {
          switch (eventType) {
            case 'block':
              
              /* data = result of web3.eth.getBlock(blockId) */
              self.external_block = data.number;
              if (self.currentBlock() != self.blockNumber) {
              	  // We just switched block boundaries
              	  self.addNewBlock(data);
			  }
              break;
            case 'error':
              /* data = Error instance */
              console.error(data);
              break;
          }
        });
      this.blocks.start().catch(console.error);
	}

	subscribeMiningAttempts(currentBlock) {
  	  var self = this;
  	  var bte;
  	  this.bitcoineum_contract.deployed().then(function(instance) {
  	  	  bte = instance;
  	  	  var event = bte.MiningAttemptEvent({fromBlock: currentBlock-256});
  	  	  console.log("Watching mining attempts from block: " + (currentBlock-256));
  	  	  event.watch(function(error, response) {
  	  	  	  console.log("Got mining attempt event");
  	  	  	  console.log(response.args._from);
  	  	  	  console.log(response.args._value.toString());
  	  	  	  console.log(response.args._blockNumber.toString());
  	  	  	  console.log(response.args._totalMinedWei.toString());
		  });
	  });
	}

	subscribeClaimEvents(currentBlock) {
  	  var self = this;
  	  var bte;
  	  this.bitcoineum_contract.deployed().then(function(instance) {
  	  	  bte = instance;
  	  	  var event = bte.BlockClaimedEvent({fromBlock: currentBlock-256});
  	  	  console.log("Watching reward claims from block: " + (currentBlock-256));
  	  	  event.watch(function(error, response) {
  	  	  	  console.log("Got block claimed event");
  	  	  	  console.log(response.args._from);
  	  	  	  console.log(response.args._reward.toString());
  	  	  	  console.log(response.args._blockNumber.toString());
		  });
	  });


	}

	addInitialBlock(blockTargetDifficultyWei, blockTotalMiningWei, blockCurrentAttemptOffset) {
		var self = this;
		self.blockNumber = self.currentBlock();
		self.tracked_blocks[self.blockNumber] = 
			new BitcoineumBlock(self,
			                    blockTargetDifficultyWei,
			                    blockTotalMiningWei,
			                    blockCurrentAttemptOffset);
		console.log("Initial Bitcoineum block: " + self.blockNumber + "(" + self.external_block + ")");
	}

	addNewBlock(web3BlockData) {
		var self = this;
		// Create a new block entry
		self.blockNumber = self.currentBlock();
		// Just because we are creating a new Bitcoineum block doesn't mean that the
		// block exists in the Bitcoineum contract, that won't happen until there is a mining
		// attempt.
		// Here we will create block data based on known state, and upate it as we get events

		self.tracked_blocks[self.blockNumber] = new BitcoineumBlock(self);
		console.log("Added Bitcoineum block: " + self.blockNumber + "(" + self.external_block + ")");
	}

	isBlockMature(Block) {
		return (this.blockNumber > (Block.blockNumber + 1 * this.blockCreationRate));
	}

	currentBlock() {
		return Math.trunc(this.external_block / this.blockCreationRate);
	}

	setMiningAccount(account) {
		return web3.isAddress(account) ? this.mining_account = account && true : false;
	}

	calculateMiningReward() {
		var self = this;
		let mined_block_period = 0;
        if (self.totalBlocksMined < self.rewardAdjustmentPeriod) {
             mined_block_period = self.rewardAdjustmentPeriod;
        } else {
             mined_block_period = self.totalBlocksMined;
        }

        let total_reward = 50;
        for (var i=0; i < (mined_block_period / self.rewardAdjustmentPeriod); i++) {
            total_reward = total_reward / 2;
        }
        return total_reward;
	}

}

module.exports = BitcoineumMiner;
