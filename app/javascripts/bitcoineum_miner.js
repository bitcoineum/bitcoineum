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
		            this.didWin = false;

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

	constructor(miningAccount, logFun) {
		var self = this;
		logFun ? this.logger = logFun : this.logger = console.log;
		self.logger("Initializing Bitcoineum Miner...");
		self.logger("Using mining account: " + miningAccount);
		this.bitcoineum_contract = contract(bitcoineum_artifacts);
		this.bitcoineum_contract.setProvider(web3.currentProvider);
		this.mining_account = miningAccount;
		this.credit_account = miningAccount;
		this.default_mine_gas = 300000;
		this.default_claim_gas = 100000;
		this.default_gas_price = 0; // This is set by default_price callback
		this.debug = false;
		self.logger("Credit mining rewards to: " + this.credit_account);
		this.auto_mine = false;

		this.tracked_blocks = {};

		this.pending_won_blocks = {};

		this.pending_check_blocks = {};

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

		this.minimumMineAttempt = null;

		// Max total spend across all minining attempts
		// 0.5 Ether limit unless specifically modified
		// Caps max loss

		this.maximumSpend = web3.toWei(0.5, 'ether');
		this.spend = web3.toWei(0, 'ether');

		// Bet limiter
		// If the bet is exceeded we cap the bet, and turn disable auto mine
		this.maxAttemptValue = web3.toWei('100', 'finney');

		// This is the percentage of the total difficulty we are going to bet
		// By default bet the entire difficulty
		this.attemptPercentage = 1;

		// Let's initialize after the node is done syncing
		// and set up callbacks

		this.waitForSync();

		this.syncStatusChange();

	}



	set_mining_account(miningAccount) {
		if (web3.isAddress(miningAccount)) {
			this.mining_account = miningAccount;
			this.logger("New mining account: " + this.mining_account);
		} else {
			this.logger("Invalid Ethereum account.");
		}
	}

	set_credit_account(creditAccount) {
		if (web3.isAddress(creditAccount)) {
			this.credit_account = creditAccount;
			this.logger("New credit to account: " + this.credit_account);
		} else {
			this.logger("Invalid Ethereum account.");
		}
	}

	set_max_spend_value(value) {
		this.maximumSpend = value;
	}

	set_mine_gas(value) {
	    this.default_mine_gas = value;
    }

    set_claim_gas(value) {
        this.default_claim_gas = value;
    }

    set_gas_price(value) {
        this.default_gas_price = value;
    }

	set_max_attempt_value(value) {
		// Probably should do some validation on this number
		this.maxAttemptValue = value;
	}

	set_attempt_percentage(value) {
		if (value > 0) {
			this.attemptPercentage = value;
			this.logger("Percentage set to: " + value + "(" + value*100 + "%)");
		} else {
			this.logger("Percentage must be greater than 0");
		}
	}

	autoMine() { 
		var self = this;
		let x = this.calculateAttemptValue();
		this.auto_mine = !this.auto_mine 
		if (this.auto_mine) {
			// Reset the max spend counter
			self.spend = 0;
			self.logger("Auto mining enabled");
			self.logger("Attempt value: " + web3.fromWei(x, 'ether') + ' ether');
			self.logger("Max attempt: " + web3.fromWei(this.maxAttemptValue, 'ether') + ' ether');
			self.logger("Attempt %: " + (this.attemptPercentage * 100) + "%");
		} else {
			self.logger("Auto mining disabled");
		}
	}

	toggleDebug() {
		this.debug = !this.debug;
		if (this.debug) {
			this.logger("debugging enabled")
		} else {
			this.logger("debugging disabled");
		}
	}

	waitForSync() {
		var self = this;
		self.logger("Waiting for sync...");
        web3.eth.getSyncing(function(error, sync){
            if(!error) {
                if(sync === true) {
                   web3.reset(true);
                } else if(sync) {
                   self.logger("Syncing: " + sync.startingBlock + " => " + sync.currentBlock + " => " + sync.highestBlock);
                   setTimeout(function() {
                   	   self.waitForSync();
				   }, 2500)
                } else {
                	web3.eth.getBlock('latest', function(err, Block) {
                		if (err != null) {
							self.logger("There was an error getting the latest block");
							self.logger("Try reloading");
							self.logger(err);
							return;
						} else {
                			self.initializeState(Block.number);
						}
					});
                }
            } else {
            	 self.logger(error);
		    }
        });
	}

    async default_price() {
	    return await new Promise(function(resolve, reject) {
	        web3.eth.getGasPrice(function(err, result) {
                err ? reject(err) : resolve(result);
            })
        });
    }

	async estimate_gas() {
	    var myCallData = bte.mine.getData();
	    var bte = await this.bitcoineum_contract.deployed();
	    let a = await web3.estimateGas(myCallData, {value: self.calculateAttemptValue()});
	    console.log("Got: " + a);
	    console.log(a);
    }

	syncStatusChange() {
		var self = this;
		web3.eth.isSyncing(function(Sync) {
			self.logger("Syncing state transition...");
		});

	}

	async update_balance() {
		var bte = await this.bitcoineum_contract.deployed();
		let a = await bte.balanceOf.call(this.credit_account);
		this.balance = a.dividedBy(100000000).valueOf();
	}

	async update_state() {

        var self = this;
        var bte = await self.bitcoineum_contract.deployed();
        let contractState = await bte.getContractState.call();

        // Break out the contract state into it's respective
        // Variables
        // Wei should be left as big numbers
        self.currentDifficultyWei = contractState[0];
        self.minimumDifficultyThresholdWei = contractState[1];

        self.last_processed_blockNumber = contractState[2].toNumber();
        self.blockCreationRate = contractState[3].toNumber();
        self.difficultyAdjustmentPeriod = contractState[4].toNumber();
        self.rewardAdjustmentPeriod = contractState[5].toNumber();
        self.lastDifficultyAdjustmentEthereumBlock = contractState[6].toNumber();
        self.totalBlocksMined = contractState[7].toNumber();

        // These should be left as big numbers
        self.totalWeiCommitted = contractState[8];
        self.totalWeiExpected = contractState[9];
        
        // Calculate the currently active Bitcoineum block
        self.blockNumber = self.currentBlock();

        self.minimumMineAttempt = self.currentDifficultyWei.dividedBy(1000000).ceil();

        if (!self.tracked_blocks.length) {
           // Add the initial block
           self.addInitialBlock(contractState[10],   // b.targetDifficultyWei
                               contractState[11],  // b.totalMiningWei
                               contractState[12]); // b.currentAttemptOffset 
        }

    }

	async initializeState(currentExternalBlock) {
        var self = this;
        await self.update_balance();
	    self.external_block = currentExternalBlock; // External best block on sync
        await self.update_state();
        self.default_gas_price = await self.default_price();
        self.printStats();
	    self.subscribeBlockWatching(); // Let's watch for new blocks
	    self.subscribeMiningAttempts(currentExternalBlock); // Let's replay mining attempts
	    self.subscribeClaimEvents(currentExternalBlock); // Let's replay mining claims
	    // For debugging let's subscribe to log events
	    // self.subscribeLogEvents(currentExternalBlock);
	}

	async printStats() {
	    let minerbalance = web3.eth.getBalance(this.mining_account);
        var self = this;
		self.logger("Miner State");
		self.logger("-------------------");
		self.logger("Bitcoineum balance: " + self.balance);
		self.logger("Miner ethereum balance: " + minerbalance + " (" + web3.fromWei(minerbalance, 'ether') + " ether)");
		self.logger("Block Window: " + self.blockNumber);
		self.logger("Minimum threshold Wei: " + self.minimumDifficultyThresholdWei + " (" + web3.fromWei(self.minimumDifficultyThresholdWei, 'ether') + " ether)");
		self.logger("Minimum mining attempt Wei: " + self.minimumMineAttempt + " (" + web3.fromWei(self.minimumMineAttempt, 'ether') + " ether)");
		self.logger("Block creation rate: " + self.blockCreationRate);
		self.logger("Difficulty adjustment period: " + self.difficultyAdjustmentPeriod);
		self.logger("Last Ethereum block adjustment: " + self.lastDifficultyAdjustmentEthereumBlock);
		self.logger("Total blocks mined: " + self.totalBlocksMined);
		self.logger("Total wei committed for mining period: " + self.totalWeiCommitted + " (" + web3.fromWei(self.totalWeiCommitted, 'ether') + " ether)");
		self.logger("Total wei expected for mining period: " + self.totalWeiExpected + " (" + web3.fromWei(self.totalWeiExpected, 'ether') + " ether)");
		self.logger("Default mine gas: " + self.default_mine_gas + " gas");
		self.logger("Default claim gas: " + self.default_claim_gas + " gas");
		self.logger("Default gas price: " + self.default_gas_price + " wei" + " (" + web3.fromWei(self.default_gas_price, 'ether') + " ether)");
		self.logger("-------------------");
		self.printConfig();
	}

	printConfig() {
		var self = this;
		self.logger("Miner configuration parameters");
		self.logger("------------------------------");
		self.logger("Mining Account: " + self.mining_account);
		self.logger("For credit to: " + self.credit_account);
		self.logger("Maximum attempt value: " + self.maxAttemptValue + " (" + web3.fromWei(self.maxAttemptValue, 'ether') + " ether)");
		self.logger("Maximum attempt percentage: " + self.attemptPercentage * 100 + "%");
		self.logger("------------------------------");
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
      this.blocks.start().then((started) => {
      		  self.logger (started ? 'Block watch started' : 'Block watch already running');
	  }).catch(console.error);
	}

	async subscribeMiningAttempts(currentBlock) {
  	  var self = this;
  	  var bte = await this.bitcoineum_contract.deployed();
  	  var event = bte.MiningAttemptEvent({fromBlock: currentBlock});
  	  	self.logger("Watching mining attempts from block: " + (currentBlock));
		event.watch(function(error, response) {
			// This could easily be extended to emit events via registered functions
			// to create an extended interface
			if (self.debug) {
				self.logger("Mine attempt: [" +  response.args._blockNumber.toString() + "][" + response.args._from + "][" + response.args._value.toString() + "][" + response.args._totalMinedWei.toString() + "]");
			}
		});
	  }

	async subscribeClaimEvents(currentBlock) {
		var self = this;
		var bte = await this.bitcoineum_contract.deployed();
		var event = bte.BlockClaimedEvent({fromBlock: currentBlock});
		self.logger("Debug: Watching reward claims from block: " + (currentBlock));
  	  	  event.watch(function(error, response) {
  	  	  	  if (self.debug) {
  	  	  	  	  self.logger("Block Claimed: [" +  response.args._blockNumber.toString() + "][" + response.args._from + "][" + response.args._forCreditTo + "][" + response.args._reward.toString() + "]");
			  }
		  });
	}

	async subscribeLogEvents(currentBlock) {
		var self = this;
		var bte = await this.bitcoineum_contract.deployed()
		var event = bte.LogEvent({fromBlock: currentBlock});
			event.watch(function(error, response) {
				self.logger("Log " + response.args._info.toString());
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
		self.logger("Initial Bitcoineum block: " + self.blockNumber + "(" + self.external_block + ")");
	}

	addNewBlock(web3BlockData) {
		var self = this;
		// Create a new block entry
		self.blockNumber = self.currentBlock();
		// Check two blocks back
		let previous_blocknum = self.blockNumber - 2;
		// Just because we are creating a new Bitcoineum block doesn't mean that the
		// block exists in the Bitcoineum contract, that won't happen until there is a mining
		// attempt.
		// Here we will create block data based on known state, and upate it as we get events

		// Check if two blocks previous has been recorded
		// And if we want to try and claim a reward

		var b = self.tracked_blocks[previous_blocknum];
		if (b) {
			// The previous block exists, and is now mature
			if (b.miningAttempted) {
				// I also tried to mine this
				self.check(previous_blocknum, function(Result) {
					if (Result) {
						if (self.auto_mine) {
						    self.claim(previous_blocknum);
						}
					} else {
						self.logger ("Block window " + previous_blocknum + " [Missed]");
					}
				});
			} else {
				self.logger("Block window " + previous_blocknum + " [Closed] ");
			}
			delete self.tracked_blocks[previous_blocknum];
		}

		self.tracked_blocks[self.blockNumber] = new BitcoineumBlock(self);
		self.logger("Block window " + self.blockNumber + " (" + self.external_block + ")[Open]");
		// If we are auto mining, then kick off a mine attempt for this block
		// given the miner parameters
		if (self.auto_mine) {
			self.mine();
		}
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

        let total_reward = 50 * (10**8);
        for (var i=1; i < (mined_block_period / self.rewardAdjustmentPeriod); i++) {
            total_reward = total_reward / 2;
        }
        return total_reward;
	}

	calculateAttemptValue() {
		var self = this;
		let x = self.currentDifficultyWei.times(self.attemptPercentage);
		if (x.greaterThan(self.maxAttemptValue)) {
			self.logger("Max difficulty exceeded bet, pausing auto mine.");
			self.auto_mine = false;
			x = self.maxAttemptValue;
		}
		return x;
	}

	// Send a mine attempt transaction
	// If there are no arguments use the current minimum difficulty
	async mine() {
		var self = this;
		var bte = await this.bitcoineum_contract.deployed()
		var attemptValue = self.calculateAttemptValue();
		self.spend += attemptValue;
		if (self.spend >= self.maximumSpend) {
			// We have exceeded the max spend
			// We may have pending redeems 
			self.logger("Maximum spend exceeded, halting auto mine");
			self.auto_mine = false;
			return;
		}
		try {
		let Res = await bte.mine({from: self.mining_account,
			gas: self.default_mine_gas,
			gasPrice: self.default_gas_price,
			value: self.calculateAttemptValue() });
		self.logger("Block window " + self.blockNumber + " [Pending]");
		self.tracked_blocks[self.blockNumber].miningAttempted = true;
		} catch(e) {
			self.logger("Block window " + self.blockNumber + " [Error]");
			self.logger(e);
		}
	}

	async check_winner(block_number) {
	    var self = this;
		var bte = await self.bitcoineum_contract.deployed();
		let Result = await bte.checkWinning.call(block_number,{from: self.mining_account});
        self.logger("Check: " + block_number + " " + Result);
    }

    async claim_block(block_number) {
        var self = this;
		var bte = await self.bitcoineum_contract.deployed();
        let Result = await bte.claim(block_number,
				             self.credit_account, 
				             {from: self.mining_account,
				                 gas: self.default_claim_gas,
				                 gasPrice: self.default_gas_price});
	   self.logger("Claim: " + block_number + " " + Result);
    }
		    

	// Did we win this block?
	// We ask the network instead of trying
	// to do this locally because block reorganizations
	// could mislead us.
	// If the network says we won, then we can try and claim our prize
	async check(block_to_check, callbackFun) {
		var self = this;
		self.logger("Block window " + block_to_check + " [Check] ");
		var bte = await self.bitcoineum_contract.deployed();

		try {
			let Result = await bte.checkWinning.call(block_to_check,
			                                     {from: self.mining_account});
		    self.logger("mining attempted so checking");
		    if (callbackFun) {
		    	callbackFun(Result);
		    } else {
		    	// Default fun
		    	if (Result) {
		    		self.logger("Block window " + block_to_check + " [Won!]");
		    	} else {
		    		self.logger("Block window " + block_to_check + " [Lost]");
		    	}
		    }
		} catch(e) {
          self.logger(e);
          self.logger("Block window " + block_to_check + " [Error]");
        }
	}

	// If we won, we should be able to claim the block
	// and redeem the Bitcoineum into our account
	
	async claim(block_to_claim) {
		var self = this;
		var bte = await self.bitcoineum_contract.deployed();
		try {
		    let RedemptionWindowCheck = await bte.checkRedemptionWindow.call(block_to_claim, self.external_block);
		    if (!RedemptionWindowCheck) {
		        self.logger("Tried to claim but outside of redemption window. [" + block_to_claim + "][" + self.external_block + "]");
		        return;
            }

			let Result = await bte.claim(block_to_claim,
				             self.credit_account, // forCreditTo
				             {from: self.mining_account,
				                 gas: self.default_claim_gas,
				                 gasPrice: self.default_gas_price});
			self.logger("Block window " + block_to_claim + " [Claimed]");
			delete self.tracked_blocks[block_to_claim];
			self.update_balance();
			self.update_state();
		} catch(e) {
			self.logger(e);
			self.logger("Block window " + block_to_claim + " [Claim Error]");
		}
	}


}

module.exports = BitcoineumMiner;
