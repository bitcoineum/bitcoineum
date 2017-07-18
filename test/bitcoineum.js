'use strict';

var Bitcoineum = artifacts.require("./Bitcoineum.sol");
const assertJump = require('zeppelin-solidity/test/helpers/assertJump');
var BitcoineumMock = artifacts.require('./helpers/BitcoineumMock.sol');

// Transmutable interface harness
var GoldMock = artifacts.require('./helpers/GoldMock.sol');
var FoolsGoldMock = artifacts.require('./helpers/FoolsGoldMock.sol');
var FakeMock = artifacts.require('./helpers/FakeMock.sol');

var BigNumber = require("bignumber.js");

// Helper functions

function awaitEvent(event, handler) {
  return new Promise((resolve, reject) => {
    function wrappedHandler(...args) {
      Promise.resolve(handler(...args)).then(resolve).catch(reject);
    }
  
    event.watch(wrappedHandler);
  });
}

function minimumWei() {
	return web3.toWei('100', 'szabo')
}

function calcTotalWei(val) {
	  return new BigNumber(val).times(2016).toString(); 
}


// Testing

contract('BitcoineumTest', function(accounts) {


  // Maxint in Ether
  var maxint = new BigNumber(2).toPower(256).minus(1);

  // Starts with static element testing for constants and setup

  it("should have 10000000 divisible units", async function() {
  	  let token = await Bitcoineum.new();
  	  let divisible = await token.divisible_units();
  	  assert.equal(divisible, 10000000, "Divisible units should be 10000000");
  });

  it("should have 8 decimals", async function() {
  	  let token = await Bitcoineum.new();
  	  let decimals = await token.decimals();
  	  assert.equal(decimals, 8, "Decimal length should be 8");
  });

  it("should have an initial base reward", async function() {
  	  let token = await Bitcoineum.new();
  	  let reward = await token.initial_reward();
  	  assert.equal(reward, 100, "Initial reward should be 100");
  });

  it("should have a difficulty scale multiplier", async function() {
  	  let token = await Bitcoineum.new();
  	  let scale = await token.difficultyScaleMultiplierLimit();
  	  assert.equal(scale, 4);
  });


  it("should have a maximum supply of 21000000 Bitcoineum", async function() {
  	  let token = await Bitcoineum.new();
  	  let maximumSupply = await token.maximumSupply();
  	  assert.equal(maximumSupply.valueOf(), 21000000 * (10**8), "Bitcoineum supply should be 21000000 with 8 decimal places");
  });

  it("should have a default current difficulty of 100 szabo", async function() {
  	  let token = await Bitcoineum.new();
  	  let currentDifficultyWei = await token.currentDifficultyWei();
      assert.equal(web3.fromWei(currentDifficultyWei, 'szabo'), "100", "Current difficulty should be 100 szabo");
  });

  it("should have a mininum that the difficulty will never fall under of 100 szabo", async function() {
  	  let token = await Bitcoineum.new();
  	  let minimumDifficultyThresholdWei = await token.minimumDifficultyThresholdWei();
      assert.equal(web3.fromWei(minimumDifficultyThresholdWei, 'szabo'), "100", "minimumDifficultyThresholdWei should be 100 szabo");
  });

	// Should be 60 in production?
  it("should have a block creation rate / window of 50 Ethereum blocks", async function() {
  	  let token = await Bitcoineum.new();
  	  let blockCreationRate = await token.blockCreationRate();
      assert.equal(blockCreationRate.valueOf(), 50, "Block creation rate/window should be 50");
  });

  it("should have a difficulty adjustment period that is 2016 Bitcoinem blocks wide", async function() {
  	  let token = await Bitcoineum.new();
  	  let difficultyAdjustmentPeriod = await token.difficultyAdjustmentPeriod();
      assert.equal(difficultyAdjustmentPeriod.valueOf(), 2016, "Difficulty adjustment should be 2016 wide");
  });

  it("should have a reward adjustment every 210000 mined Bitcoinem Blocks", async function() {
  	  let token = await Bitcoineum.new();
  	  let rewardAdjustmentPeriod = await token.rewardAdjustmentPeriod();
      assert.equal(rewardAdjustmentPeriod.valueOf(), 210000, "Reward adjustment should be 210000 blocks wide");
  });


  it("should have no blocks mined by default", async function() {
  	  let token = await Bitcoineum.new();
  	  let totalBlocksMined = await token.totalBlocksMined();
      assert.equal(totalBlocksMined.valueOf(), 0, "There should be no blocks mined");
  });


  it("should have an expected amount of ether in the adjustment period", async function() {
  	  let token = await Bitcoineum.new();
  	  let totalWeiExpected = await token.totalWeiExpected();
      assert.equal(web3.fromWei(totalWeiExpected, 'ether'), "0.2016", "The entire amount of Ether in a 2016 block period should be 0.2016");
  });


  it("should have a provably unspendable burn address", async function() {
  	  let token = await Bitcoineum.new();
  	  let burnAddress = await token.burnAddress();
      assert.equal(burnAddress,"0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead", "Burn address should be dead");
  });

 // Now lets test all of the static functions which make up the majority of
 // the code.

  it("should calculate the block window based on the external ethereum block", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.external_to_internal_block_number(0);
  	  assert.equal(res.valueOf(), 0, "External block 0 should be window 0");
  	  res = await token.external_to_internal_block_number(100);
  	  assert.equal(res.valueOf(), 2, "External block 100 should be window 2");
  	  res = await token.external_to_internal_block_number(1000);
  	  assert.equal(res.valueOf(), 20, "External block 1000 should be window 20");
  	  res = await token.external_to_internal_block_number(maxint);
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(50).toString(), "External block maxint should be window maxint divided by 50");
  });

  it("should correctly scale the attempt to the keyspace", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.calculate_difficulty_attempt(minimumWei(), 0, minimumWei());
    	assert.equal(res.toString(), maxint.toString(), "Matching the current difficulty with no other participants should exhaust the keyspace");
      res = await token.calculate_difficulty_attempt.call(minimumWei(), 0, 0);
  	  assert.equal(res.valueOf(), 0, "A zero attempt should return zero keyspace");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), 0, web3.toWei('100', 'ether'));
  	  assert.equal(res.toString(), maxint.toString(), "Value that exceeds keyspace value should dominate it without other participants");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), minimumWei(), web3.toWei('50', 'szabo'));
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).times(5000000).toString(), "Keyspace should be %50 with two participants equaling the target difficulty");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), web3.toWei('200', 'szabo'), minimumWei());
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).times(5000000).toString(), "Keyspace should be %50 with two partipants that double the currentdifficulty");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), web3.toWei('25', 'szabo'), web3.toWei('25', 'szabo'));
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).times(2500000).toString(), "Keyspace should be %25");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), minimumWei(), new BigNumber(minimumWei()).dividedToIntegerBy(10000000));
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).toString(), "The smallest unit is a millionth of the current minimum difficulty");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), minimumWei(), new BigNumber(minimumWei()).dividedToIntegerBy(10000000).plus(1));
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000), "This will yield the same keyspace percentage.");
  	  res = await token.calculate_difficulty_attempt.call(minimumWei(), web3.toWei('10000000', 'ether'), web3.toWei('10000000', 'ether'));
  	  // 10 million ether bet, overwhelm the expected difficulty
  	  assert.equal(res.toString(), maxint.toString(), "Value dominates user keyspace");
  	  res = await token.calculate_difficulty_attempt.call(web3.toWei('100000000', 'ether'), web3.toWei('10000000', 'ether'), minimumWei());
  	  assert.equal(res, 0, "Attempt should wash out under minimum divisible unit");
  });

  it("should correctly return range search", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.calculate_range_attempt(minimumWei(), minimumWei());
    	assert.equal(res[0].toString(), minimumWei(), "Start offset is not correct");
    	assert.equal(res[1].toString(), new BigNumber(minimumWei()).plus(minimumWei()), "End offset is not correct");
      res = await token.calculate_range_attempt(0, 0);
      assert.equal(res[0].toString(), res[1].toString(), "Start end end offset should be 0");
      try  {
         await token.calculate_range_attempt(maxint, 1);
	  } catch(error) {
	  	  return assertJump(error);
	  }
  });

  it("should correctly calculate the base mining reward", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.calculate_base_mining_reward(0) 
  	  assert.equal(res.valueOf(), 100 * (10**8), "At internal block 0, we reward 50 Bitcoineum");
      res = await token.calculate_base_mining_reward(1)
      assert.equal(res.valueOf(), 100 * (10**8), "At internal block 0, we reward 50 Bitcoineum");
      res = await token.calculate_base_mining_reward(210000)
      assert.equal(res.valueOf(), 100 * (10**8), "100 Bitcoineum up until block 210000");
      res = await token.calculate_base_mining_reward(210001)
      assert.equal(res.valueOf(), 50 * (10**8), "25 Bitcoineum immediately after block 210000");
      res = await token.calculate_base_mining_reward(420001);
      assert.equal(res.valueOf(), 25 * (10**8), "12.5 Bitcoineum immediately after block 410000");
  });

  it("should correctly calculate the proportional mining reward", async function() {
  	  let token = await Bitcoineum.new();
  	  let baseReward = await token.calculate_base_mining_reward(0) 
  	  let res = await token.calculate_proportional_reward(baseReward, minimumWei(), minimumWei() ); 
  	  assert.equal(res.valueOf(), baseReward.valueOf(), "Proportional reward should be full reward");
  	  res = await token.calculate_proportional_reward(baseReward, minimumWei(), web3.toWei('200', 'szabo')); 
  	  assert.equal(res.valueOf(), baseReward.dividedToIntegerBy(2).valueOf(), "Proportional reward should be half of full reward for 50% burn contribution");
  	  res = await token.calculate_proportional_reward(baseReward, minimumWei(), web3.toWei('400', 'szabo')); 
  	  assert.equal(res.valueOf(), baseReward.dividedToIntegerBy(4).valueOf(), "Proportional reward should be half of full reward for 25% burn contribution");
  	  res = await token.calculate_proportional_reward(baseReward, web3.toWei('400', 'ether'), web3.toWei('400', 'ether')); 
  	  assert.equal(res.valueOf(), baseReward, "Proportional reward should be full reward");

	  try  {
	  	  await token.calculate_proportional_reward(baseReward, web3.toWei('400', 'ether'), web3.toWei('100', 'ether')); 
	  } catch(error) {
	  	return assertJump(error);
	  }

	  try  {
	  	  await token.calculate_proportional_reward(baseReward, web3.toWei('100', 'ether'), web3.toWei('50', 'ether')); 
	  } catch(error) {
	  	return assertJump(error);
	  }

	  try  {
	  	  await token.calculate_proportional_reward(baseReward, web3.toWei('0', 'ether'), web3.toWei('50', 'ether')); 
	  } catch(error) {
	  	return assertJump(error);
	  }
  });

  it("should correctly calculate next expected wei on difficulty adjustment", async function() {
  	  let token = await Bitcoineum.new();
      let res = await token.calculate_next_expected_wei(minimumWei(), minimumWei(), minimumWei(), 4)
      assert.equal(res.toString(), minimumWei(), "Difficulty remains constant if expected wei is equivalent ot committed wei");
      res = await token.calculate_next_expected_wei(web3.toWei('200', 'szabo'), minimumWei(), minimumWei(), 4);
      assert.equal(res.toString(), web3.toWei('200', 'szabo'), "Difficulty should scale up if wei committed is greater than expected.");
      res = await token.calculate_next_expected_wei(web3.toWei('500', 'szabo'), minimumWei(), minimumWei(), 4);
      assert.equal(res.toString(), web3.toWei('400', 'szabo'), "Difficulty expansion should be capped at multiple of expected wei");
  	  res = await token.calculate_next_expected_wei(web3.toWei('150', 'szabo'), web3.toWei('200', 'szabo'), minimumWei(), 4);
  	  assert.equal(res.toString(), web3.toWei('150', 'szabo'), "Difficulty should scale down if wei committed is less than expected.");
  	  res = await token.calculate_next_expected_wei(web3.toWei('200', 'szabo'), web3.toWei('1000', 'szabo'), minimumWei(), 4);
  	  assert.equal(res.toString(), web3.toWei('250', 'szabo'), "Difficulty should be prevented from falling too far during readjustment.");
  	  res = await token.calculate_next_expected_wei(web3.toWei('50', 'szabo'), minimumWei(), minimumWei(), 4);
  	  assert.equal(res.toString(), minimumWei(), "Minimum difficulty should not fall under 100 szabo");
  });

  it("should calculate the target block number for a mining window", async function() {
  	  let token = await Bitcoineum.new();
      let res = await token.targetBlockNumber(1) 
      assert.equal(res.valueOf(), 100, "The block matures at the beginning of the next window");
      res = await token.targetBlockNumber(3969300);
      assert.equal(res.valueOf(), 3969301*50, "Block matures in the next window");
  });

  it("should check block maturity", async function() {
  	  let token = await Bitcoineum.new();
      let res = await token.checkBlockMature(1, 100) 
      assert.isTrue(res)
	  res = await token.checkBlockMature(1, 99)
	  assert.isFalse(res);
	  res = await token.checkBlockMature(1000, 50050)
	  assert.isTrue(res);
  });

  it("should validate the redemption window", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.checkRedemptionWindow(1, 50); 
  	  assert.isFalse(res);
  	  res = await token.checkRedemptionWindow(100, 5050); 
  	  assert.isTrue(res);
  	  res = await token.checkRedemptionWindow(100, 5305, "At threshold"); 
  	  assert.isTrue(res);
  	  res = await token.checkRedemptionWindow(100, 5306, "Pass threshold"); 
  	  assert.isFalse(res);
	});

  it("should reject an invalid mining attempt", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.checkMiningAttempt(1, "0x1b66cad21e9f4fb07ecb32fe5e5928415b8348a2");
  	  assert.isFalse(res);
  	  res = await token.checkMiningAttempt(maxint, "0x1b66cad21e9f4fb07ecb32fe5e5928415b8348a2"); 
  	  assert.isFalse(res);
  });

	/* We tested individual static functions above
	*  but just to be thorough let's grab the total relevant
	* initial state atomically via getContractState
	*/
  it("should have a specific initial contract state", async function() {
  	  let token = await Bitcoineum.new();
  	  let res = await token.getContractState(); 
  	  let currentDifficultyWei = res[0];
  	  let minimumDifficultyThresholdWei = res[1];
      let blockNumber = res[2];
      let blockCreationRate = res[3];
      let difficultyAdjustmentPeriod = res[4];
      let rewardAdjustmentPeriod = res[5];
      let lastDifficultyAdjustmentEthereumBlock = res[6];
      let totalBlocksMined = res[7];
      let totalWeiCommitted = res[8];
      let totalWeiExpected = res[9];
      let blockTargetDifficultyWei = res[10];
      let blockTotalMiningWei = res[11];
      let blockCurrentAttemptOffset = res[12];
      assert.equal(currentDifficultyWei, minimumWei());
      assert.equal(minimumDifficultyThresholdWei, minimumWei());
      assert.equal(blockCreationRate.valueOf(), 50);
      assert.equal(difficultyAdjustmentPeriod.valueOf(), 2016);
      assert.equal(rewardAdjustmentPeriod.valueOf(), 210000);
      assert.notEqual(lastDifficultyAdjustmentEthereumBlock.valueOf(), 1);
      assert.equal(totalBlocksMined.valueOf(), 0);
      assert.equal(totalWeiCommitted.valueOf(), 0);
      assert.equal(totalWeiExpected.toString(), new BigNumber(minimumWei()).times(2016)); // Entire adjustment window wei expected, i.e 2016 internal blocks with the current expected wei per block
      assert.equal(blockTargetDifficultyWei.toString(), minimumWei());
      assert.equal(blockTotalMiningWei.valueOf(), 0);
      assert.equal(blockCurrentAttemptOffset.valueOf(), 0);
  });

  // Let's use the mock Bitcoineum to test main functions


	it('should mock Bitcoineum correctly', async function() {
		let token = await BitcoineumMock.new();
		let blockNumber = await token.get_internal_block_number();
		assert.equal(blockNumber.valueOf(), 0);
	});


	it('should be able to set the block on the mock contract', async function() {
		let token = await BitcoineumMock.new();
		await token.set_block(10000);
		let blockNumber = await token.current_external_block();
		assert.equal(blockNumber, 10000);
		// For test harness verification
		let internalBlockNumber = await token.get_internal_block_number();
		assert.equal(internalBlockNumber.valueOf(), 200);  // 200th window
	});

	describe('During mining operations', function() {

	it('should burn all mining attempts', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		let balance = await web3.eth.getBalance("0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD");
		assert.equal(balance.valueOf(), minimumWei());
	});


	it('should let me attempt to mine', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		let totalWeiCommitted = await token.totalWeiCommitted();
		assert.equal(totalWeiCommitted.toString(), minimumWei());
	});

	it("should correctly flag a block as redeemed", async function() {
  	  let token = await BitcoineumMock.new();
  	  let res = await token.isBlockRedeemed(0);
  	  assert.equal(res, false);
  	  await token.set_current_difficulty(web3.toWei('1', 'ether'));
  	  await token.set_total_wei_expected(calcTotalWei(web3.toWei('1', 'ether')));
  	  await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
  	  await token.set_block(51);
  	  await token.claim(0, accounts[0], {from: accounts[0]});
  	  res = await token.isBlockRedeemed(0);
  	  assert.equal(res, true);
  });


	it('should not let me attempt to mine less than the minimum wei', async function() {
		let token = await BitcoineumMock.new();
		try  {
			await token.mine({from: accounts[0], value: 100});
		} catch(error) {
			return assertJump(error);
		}
	});

	it('should not let me mine more than the maximum attempt', async function() {
		let token = await BitcoineumMock.new();
		try {
			await token.mine({from: accounts[0], value: web3.toWei('1000001', 'ether')});
		} catch(error) {
			return assertJump(error)
		}	
	});

	it('should have mining active by default', async function() {
		let token = await BitcoineumMock.new();
		let flag = await token.checkMiningActive();
		assert.equal(flag, true);
	});

	it('should ensure mining stops when maximum supply is reached', async function() {
		let token = await BitcoineumMock.new();
		await token.set_total_supply(21000000 * (10**8)+1);
		try {
			await token.mine({from: accounts[0], value: minimumWei()});
		} catch(error) {
			return assertJump(error)
		}
	});

	it('should create a block entry on mining attempt', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		let [targetDifficultyWei, blockNumber, totalMiningWei, totalMiningAttempts, currentAttemptOffset, payed, payee, isCreated] = await token.getBlockData(0);
		// Let's verify defaults
		assert.equal(targetDifficultyWei, minimumWei());
		assert.equal(blockNumber, 0);
		assert.equal(totalMiningWei, minimumWei());
		assert.equal(totalMiningAttempts, 1);
		assert.equal(currentAttemptOffset, minimumWei());
		assert.equal(payed, false);
		assert.equal(isCreated, true);
	});

	it('should set block difficulty correctly', async function() {
		let token = await BitcoineumMock.new();
		let lastAdjustment = await token.lastDifficultyAdjustmentEthereumBlock();
		await token.set_total_wei_committed(calcTotalWei(web3.toWei('100', 'ether')))
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('1', 'ether')));
		// Jump into the future 
		await token.set_block(lastAdjustment.plus(2016*50).plus(1));
		let currentBlockWindow = lastAdjustment.plus(2016*50).plus(1).dividedToIntegerBy(50);
		await token.mine({from: accounts[0], value: minimumWei()});
		let [targetDifficultyWei, blockNumber, totalMiningWei, totalMiningAttempts, currentAttemptOffset, payed, payee, isCreated] = await token.getBlockData(currentBlockWindow);
		// Let's verify defaults
		assert.equal(targetDifficultyWei.toString(), web3.toWei('4', 'ether'));
		assert.equal(totalMiningWei, minimumWei());
		assert.equal(totalMiningAttempts, 1);
		assert.equal(currentAttemptOffset, minimumWei());
		assert.equal(payed, false);
		assert.equal(isCreated, true);
	});


	it('should not allow me to attempt to mine twice from the same address', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		try {
			await token.mine({from: accounts[0], value: minimumWei()});
		} catch(error) {
			return assertJump(error);
		}
	});

	it('should increment mining attempts and attempt offset on sequential mining attempts', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		await token.mine({from: accounts[1], value: minimumWei()});
		await token.mine({from: accounts[2], value: minimumWei()});
		let [targetDifficultyWei, blockNumber, totalMiningWei, totalMiningAttempts, currentAttemptOffset, payed, payee, isCreated] = await token.getBlockData(0);
		assert.equal(totalMiningAttempts, 3);
		assert.equal(currentAttemptOffset, web3.toWei('300', 'szabo'));
		assert.equal(totalMiningWei, web3.toWei('300', 'szabo'));
	});

	it('should correctly populate the mining attempt structure', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		await token.mine({from: accounts[1], value: minimumWei()});
		await token.mine({from: accounts[2], value: minimumWei()});
		let [offset, value, created] = await token.getMiningAttempt(0, accounts[0]);
		assert.equal(offset, 0);
		assert.equal(value, minimumWei());
		assert.equal(created, true);
		[offset, value, created] = await token.getMiningAttempt(0, accounts[1]);
		assert.equal(offset, minimumWei());
		assert.equal(value, minimumWei());
		assert.equal(created, true);
		[offset, value, created] = await token.getMiningAttempt(0, accounts[2]);
		assert.equal(offset.toString(), web3.toWei('200', 'szabo'));
		assert.equal(value, minimumWei());
		assert.equal(created, true);
	});



	// Let's watch for the mining attempt event
	
	it('should generate mining attempt events', async function() {
		let token = await BitcoineumMock.new();
		let event = token.MiningAttemptEvent({});

		let watcher = async function(err, result) {
			event.stopWatching();
			if (err) { throw err; }
			assert.equal(result.args._from, accounts[0]);
			assert.equal(result.args._value, minimumWei());
			assert.equal(result.args._blockNumber, 0);
			assert.equal(result.args._totalMinedWei, minimumWei());
			assert.equal(result.args._targetDifficultyWei, minimumWei());
		};
		token.mine({from: accounts[0], value: minimumWei()});
		await awaitEvent(event, watcher);
	});

	});

	describe('During claim/redemption operations', function() {

		it('should not allow me to claim a non existing block', async function() {
			let token = await BitcoineumMock.new();
			try {
				await token.claim(0, accounts[0]);
			} catch(error) {
				return assertJump(error);
			}
		});

		it('should not allow me to claim a block that has not matured', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[0], value: minimumWei()});
			await token.set_block(10);
			try {
				await token.claim(0, accounts[0]);
			} catch(error) {
				return assertJump(error);
			}
		});

		it('should allow me to redeem a block that has matured', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
			await token.set_block(51);
			let ret = await token.claim(0, accounts[0]);
		});

		it('should not allow me to redeem a block twice', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
			await token.set_block(51);
			await token.claim(0, accounts[0]);
			try {
				await token.claim(0, accounts[0]);
			} catch(error) {
				return assertJump(error);
			}
		});

		it('should not allow a third party to redeem a lost block', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
			await token.mine({from: accounts[1], value: web3.toWei('10', 'szabo')});
			await token.set_block(51);
			await token.claim(0, accounts[0]);
			try {
				await token.claim(0, accounts[0], {from: accounts[1]});
			} catch(error) {
				return assertJump(error);
			}
		});


		it('show not allow me to redeem a block that I have not attempted to mine', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[1], value: web3.toWei('1', 'ether')});
			await token.set_block(51);
			try {
				await token.claim(0, accounts[0]);
			} catch(error) {
				return assertJump(error);
			}

		});

		it('should not let me redeem a block that I lost', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[1], value: web3.toWei('1', 'ether')});
			await token.mine({from: accounts[0], value: web3.toWei('10', 'szabo')});
			await token.set_block(51);
			try {
				await token.claim(0, accounts[0]);
			} catch(error) {
				return assertJump(error);
			}
		});

		it('should let me redeem a block I won with multiple participants', async function() {
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[1], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[2], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[3], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[4], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[5], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[6], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[7], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[8], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[9], value: web3.toWei('10', 'szabo')});
			await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
			await token.set_block(51);
			let ret = await token.claim(0, accounts[0]);
		});

		it('should not let me redeem a block outside of the redemption window', async function() { 
			let token = await BitcoineumMock.new();
			await token.mine({from: accounts[0], value: minimumWei()});
			await token.set_block(150);
			try {
				await token.claim(0, accounts[0]);
			} catch(error) {
				return assertJump(error);
			}
		});

	it('should generate claim and transfer events', async function() {
		let token = await BitcoineumMock.new();
		let claimedEvent = token.BlockClaimedEvent({});
		let transferEvent = token.Transfer({});

		let claimWatcher = async function(err, result) {
			claimedEvent.stopWatching();
			if (err) { throw err; }
			assert.equal(result.args._from, accounts[0]);
			assert.equal(result.args._forCreditTo, accounts[0]);
			assert.equal(result.args._reward.valueOf(), 100 * (10**8)); 
			assert.equal(result.args._blockNumber, 0);
		};

		let transferWatcher = async function(err, result) {
			transferEvent.stopWatching();
			if (err) { throw err; }
			assert.equal(result.args.from, token.address);
			assert.equal(result.args.to, accounts[0]);
			assert.equal(result.args.value, 100 * (10**8));
		};


		await token.mine({from: accounts[0], value: minimumWei()});
		await token.set_block(100);
		token.claim(0, accounts[0]);
		await awaitEvent(claimedEvent, claimWatcher);
		await awaitEvent(transferEvent, transferWatcher);
	});

	it('should let me verify winning status asynchronously', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(51);
		let status = await token.checkWinning(0);
		assert.equal(status, true);
		status = await token.checkWinning(0, {from: accounts[1]});
		assert.equal(status, false);
	});

		
	it('should update my balance if I mine successfully', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[0]);
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 100*(10**8));
	});

	it('should update a beneficiary balance if I mine successfully', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[1]);
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 0);
		balance = await token.balanceOf(accounts[1]);
		assert.equal(balance.valueOf(), 100*(10**8));
	});


	it('should update the total supply on claim event', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[0]);
		let totalSupply = await token.totalSupply();
		assert.equal(totalSupply.valueOf(), 100*(10**8));
		await token.set_blocks_mined(211000);
		await token.set_block(1000);
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(1051);
		await token.claim(20, accounts[0]);
		totalSupply = await token.totalSupply();
		assert.equal(totalSupply.valueOf(), 100*(10**8) + 50*(10**8));
	});

	it('should update block entry on claim event', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		await token.set_block(51);
		await token.claim(0, accounts[0]);
		let [targetDifficultyWei, blockNumber, totalMiningWei, totalMiningAttempts, currentAttemptOffset, payed, payee, isCreated] = await token.getBlockData(0);
		// Let's verify defaults
		assert.equal(targetDifficultyWei, minimumWei());
		assert.equal(blockNumber, 0);
		assert.equal(totalMiningWei, minimumWei());
		assert.equal(totalMiningAttempts, 1);
		assert.equal(currentAttemptOffset, minimumWei());
		assert.equal(payed, true);
		assert.equal(payee, accounts[0]);
		assert.equal(isCreated, true);
	});

	it('should adjust the reward based on blocks mined/claimed', async function() {
		let token = await BitcoineumMock.new();
		await token.set_blocks_mined(211000);
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[0]);
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8));
		await token.set_blocks_mined(422000);
		await token.set_block(1000);
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(1051);
		await token.claim(20, accounts[0]);
		balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8) + 25*(10**8));
		await token.set_blocks_mined(633000);
		await token.set_block(2000);
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.set_block(2051);
		await token.claim(40, accounts[0]);
		balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8) + 25*(10**8) + 12.5*(10**8));
	});


	it('should distribute a proportional reward when mining exceed total difficulty', async function() {
		let token = await BitcoineumMock.new();
		await token.set_current_difficulty(web3.toWei('1', 'ether'));
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('1', 'ether')));

		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		await token.mine({from: accounts[1], value: web3.toWei('1', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[0]);
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8));
	});

	it('should distribute a proportional reward when mining is under total difficulty', async function() {
		let token = await BitcoineumMock.new();
		await token.set_current_difficulty(web3.toWei('1', 'ether'));
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('1', 'ether')));
		await token.mine({from: accounts[0], value: web3.toWei('0.25', 'ether')});
		await token.mine({from: accounts[1], value: web3.toWei('0.25', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[0], {from: accounts[0]});
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8));
	});

	it('should distribute a proportional reward when mining is equal to difficulty', async function() {
		let token = await BitcoineumMock.new();
		await token.set_current_difficulty(web3.toWei('1', 'ether'));
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('1', 'ether')));
		await token.mine({from: accounts[0], value: web3.toWei('0.5', 'ether')});
		await token.mine({from: accounts[1], value: web3.toWei('0.5', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[0], {from: accounts[0]});
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8));
	});

	it('should distribute a proportional reward at minimal difficulty', async function() {
		let token = await BitcoineumMock.new();
		await token.set_current_difficulty(web3.toWei('200', 'szabo'));
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('200', 'szabo')));
		await token.mine({from: accounts[0], value: minimumWei()});
		await token.mine({from: accounts[1], value: minimumWei()});
		await token.set_block(51);
		await token.claim(0, accounts[0], {from: accounts[0]});
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 50*(10**8));
	});

	it('should distribute a proportional reward at minimal difficulty', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: minimumWei()});
		await token.set_block(51);
		await token.claim(0, accounts[0], {from: accounts[0]});
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 100*(10**8));
	});

	it('should distribute a proportional reward at high total committment', async function() {
		let token = await BitcoineumMock.new();
		await token.mine({from: accounts[0], value: web3.toWei('1000000', 'ether')});
		await token.mine({from: accounts[1], value: web3.toWei('1000000', 'ether')});
		await token.mine({from: accounts[2], value: web3.toWei('1000000', 'ether')});
		await token.mine({from: accounts[3], value: web3.toWei('1000000', 'ether')});
		await token.set_block(51);
		await token.claim(0, accounts[1], {from: accounts[1]});
		let balance = await token.balanceOf(accounts[1]);
		assert.equal(balance.valueOf(), 25*(10**8));
	});

	});

	describe('During difficulty adjustments', function() {


	it('should adjust Difficulty up to capped multiple', async function() {
		let token = await BitcoineumMock.new();
		let lastAdjustment = await token.lastDifficultyAdjustmentEthereumBlock();

		// Jump into the future 
		await token.set_block(lastAdjustment.plus(2016*50).plus(1));
		// 5 time the difficulty expected in a default period
		await token.set_total_wei_committed(calcTotalWei(web3.toWei('500', 'szabo')))
		await token.mine({from: accounts[0], value: minimumWei()});
		let totalWeiExpected = await token.totalWeiExpected();
		let totalWeiCommitted = await token.totalWeiCommitted();
		let currentDifficulty = await token.currentDifficultyWei();
		assert.equal(totalWeiCommitted.valueOf(), minimumWei());
		assert.equal(totalWeiExpected.toString(), calcTotalWei(web3.toWei('400', 'szabo')));
		assert.equal(currentDifficulty.toString(), web3.toWei('400', 'szabo'));
	});

	it('should adjust Difficulty down by capped percentage', async function() {
		let token = await BitcoineumMock.new();
		let lastAdjustment = await token.lastDifficultyAdjustmentEthereumBlock();
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('1', 'ether')));
		// Jump into the future 
		await token.set_block(lastAdjustment.plus(2016*50).plus(1));
		await token.set_total_wei_committed(calcTotalWei(web3.toWei('0.1', 'ether')))
		await token.mine({from: accounts[0], value: web3.toWei('1', 'ether')});
		let totalWeiExpected = await token.totalWeiExpected();
		let totalWeiCommitted = await token.totalWeiCommitted();
		let currentDifficulty = await token.currentDifficultyWei();
		assert.equal(totalWeiCommitted.valueOf(), web3.toWei('1', 'ether'));
		// Should be 1/4 of expected wei rather than 1/10 that was committed
		assert.equal(totalWeiExpected.toString(), calcTotalWei(web3.toWei('0.25', 'ether')));
		assert.equal(currentDifficulty.toString(), web3.toWei('0.25', 'ether'));
	});

	it('should not adjust below minimum difficulty', async function() {
		let token = await BitcoineumMock.new();
		let lastAdjustment = await token.lastDifficultyAdjustmentEthereumBlock();
		await token.set_total_wei_expected(calcTotalWei(web3.toWei('200', 'szabo')));
		// Jump into the future 
		await token.set_block(lastAdjustment.plus(2016*50).plus(1));
		await token.set_total_wei_committed(calcTotalWei(web3.toWei('50', 'szabo')))
		await token.mine({from: accounts[0], value: web3.toWei('50', 'szabo')});
		let totalWeiExpected = await token.totalWeiExpected();
		let totalWeiCommitted = await token.totalWeiCommitted();
		let currentDifficulty = await token.currentDifficultyWei();
		assert.equal(totalWeiCommitted.valueOf(), web3.toWei('50', 'szabo'));
		// Difficulty should now go below 100 szabo per block
		assert.equal(totalWeiExpected.toString(), calcTotalWei(minimumWei()));
		assert.equal(currentDifficulty.toString(), minimumWei());
	});

	});


	describe('Follows the Transmute interface for functional building blocks', function() {

	it('should not let transmute without a balance', async function() {
		let token = await BitcoineumMock.new();
		let token2 = await GoldMock.new(); 
		try {
			await token.transmute(token2.address, 100);
		} catch(error) {
			return assertJump(error)
		}
	});

	it('should not let me transmute more than balance', async function() {
		let token = await BitcoineumMock.new();
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await GoldMock.new(); 

		try {
			await token.transmute(token2.address, 100*(10**8)+1);
		} catch(error) {
			return assertJump(error)
		}
		// Balance should be unaffected
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance, 100*(10**8));
	});

	it('should not let me transmute to a contract that does not support TransmutableInterface', async function() {
		let token = await BitcoineumMock.new();
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await FakeMock.new(); 

		try {
			await token.transmute(token2.address, 25*(10**8));
		} catch(error) {
			return assertJump(error)
		}

		// Balance should be unaffected
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance, 100*(10**8));
	});

	it('should restore everything on failed transmute', async function() {
		let token = await BitcoineumMock.new();
		await token.set_total_supply(100*(10**8));
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await FoolsGoldMock.new(); 

		try {
			await token.transmute(token2.address, 25*(10**8));
		} catch(error) {
			return assertJump(error)
		}

		// Balance should be unaffected
		let balance = await token.balanceOf(accounts[0]);
		assert.equal(balance, 100*(10**8));
		let total = await token.totalSupply();
		assert.equal(total, 100*(10**8));
	});

	it('should not let me transmute a 0 quantity', async function() {
		let token = await BitcoineumMock.new();
		await token.set_total_supply(100*(10**8));
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await GoldMock.new(); 

		try {
			await token.transmute(token2.address, 0);
		} catch(error) {
			return assertJump(error)
		}
	});

	it('should let me transmute my balance', async function() {
		let token = await BitcoineumMock.new();
		await token.set_total_supply(100*(10**8));
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await GoldMock.new(); 
		let res = await token.transmute(token2.address, 100*(10**8));
		let balance = await token2.total();
		assert.equal(balance, 100*(10**8));
	});

	it('should let me transmute a partial balance', async function() {
		let token = await BitcoineumMock.new();
		await token.set_total_supply(100*(10**8));
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await GoldMock.new(); 
		let balance = await token2.total();
		assert.equal(balance, 0);
		let res = await token.transmute(token2.address, 25*(10**8));
		balance = await token2.total();
		assert.equal(balance, 25*(10**8));
		balance = await token.balanceOf(accounts[0]);
		assert.equal(balance.valueOf(), 75*(10**8));
		let total = await token.totalSupply();
		assert.equal(total, 75*(10**8));
	});


	it('should generate trasmute events', async function() {
		let token = await BitcoineumMock.new();
		await token.set_total_supply(100*(10**8));
		await token.set_balance(accounts[0], 100*(10**8));
		let token2 = await GoldMock.new()
		let event = token.Transmuted({});

		let watcher = async function(err, result) {
			event.stopWatching();
			if (err) { throw err; }
			assert.equal(result.args.who, accounts[0]);
			assert.equal(result.args.baseContract, token.address);
			assert.equal(result.args.transmutedContract, token2.address);
			assert.equal(result.args.sourceQuantity, 100*(10**8));
			assert.equal(result.args.destQuantity, 100*(10**8));
		};
		token.transmute(token2.address, 100*(10**8));
		await awaitEvent(event, watcher);
	});


	});

	});

