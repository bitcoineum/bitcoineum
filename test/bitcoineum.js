var Bitcoineum = artifacts.require("./Bitcoineum.sol");

var BigNumber = require("bignumber.js");

contract('Bitcoineum', function(accounts) {


  // Maxint in Ether
  var maxint = new BigNumber(2).toPower(256).minus(1);

  // Starts with static element testing for constants and setup
  it("should have 8 decimals", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.decimals.call();
    }).then(function(decimals) {
      assert.equal(decimals.valueOf(), 8, "Decimal length should be 8");
    });
  });
  it("should have a maximum supply of 21000000 Bitcoineum", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.maximumSupply.call();
    }).then(function(supply) {
      assert.equal(supply.valueOf(), 21000000 * (10**8), "Bitcoineum supply should be 21000000 with 8 decimal places");
    });
  });

  it("should have a default current difficulty of 100 szabo", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.currentDifficultyWei.call();
    }).then(function(difficulty) {
      assert.equal(web3.fromWei(difficulty, 'szabo'), "100", "Current difficulty should be 100 szabo");
    });
  });

  it("should have a mininum that the difficulty will never fall under of 100 szabo", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.minimumDifficultyThresholdWei.call();
    }).then(function(difficulty) {
      assert.equal(web3.fromWei(difficulty, 'szabo'), "100", "minimumDifficultyThresholdWei should be 100 szabo");
    });
  });

	// Should be 60 in production?
  it("should have a block creation rate / window of 10 Ethereum blocks", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.blockCreationRate.call();
    }).then(function(rate) {
      assert.equal(rate.valueOf(), 10, "Block creation rate/window should be 10");
    });
  });

  it("should have a difficulty adjustment period that is 2016 Bitcoinem blocks wide", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.difficultyAdjustmentPeriod.call();
    }).then(function(period) {
      assert.equal(period.valueOf(), 2016, "Difficulty adjustment should be 2016 wide");
    })
  });

  it("should have a reward adjustment every 210000 mined Bitcoinem Blocks", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.rewardAdjustmentPeriod.call();
    }).then(function(period) {
      assert.equal(period.valueOf(), 210000, "Reward adjustment should be 210000 blocks wide");
    });
  });


  it("should have no blocks mined by default", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.totalBlocksMined.call();
    }).then(function(blocks) {
      assert.equal(blocks.valueOf(), 0, "There should be no blocks mined");
    });
  });


  it("should have an expected amount of ether in the adjustment period", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.totalWeiExpected.call();
    }).then(function(wei) {
      assert.equal(web3.fromWei(wei, 'ether'), "0.2016", "The entire amount of Ether in a 2016 block period should be 0.2016");
    });
  });


  it("should have a provably unspendable burn address", function() {
    return Bitcoineum.deployed().then(function(instance) {
      return instance.burnAddress.call();
    }).then(function(address) {
      assert.equal(address,"0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead", "Burn address should be dead");
    });
  });

 // Now lets test all of the static functions which make up the majority of
 // the code.

  it("should calculate the block window based on the external ethereum block", function() {
  	  var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.external_to_internal_block_number.call(0);
    }).then(function(res) {
      assert.equal(res,0, "External block 0 should be window 0");
      return bte.external_to_internal_block_number.call(100);
    }).then(function(res) {
    	assert.equal(res,10, "External block 100 should be window 10");
        return bte.external_to_internal_block_number.call(1000);
	}).then(function(res) {
		assert.equal(res,100, "External block 1000 should window 100");
        return bte.external_to_internal_block_number.call(maxint);
	}).then(function(res) {
		assert.equal(res.toString(), maxint.dividedToIntegerBy(10).toString(), "Should be 10% of total");
	});
  });

  it("should correctly scale the attempt to the keyspace", function() {
  	  var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), 0, web3.toWei('100', 'szabo'));
    }).then(function(res) {
    	assert.equal(res.toString(), maxint.toString(), "Matching the current difficulty with no other participants should exhaust the keyspace");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), 0, 0);
  }).then(function(res) {
  	  assert.equal(res.valueOf(), 0, "A zero attempt should return zero keyspace");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), 0, web3.toWei('100', 'ether'));
  }).then(function(res) {
  	  assert.equal(res.toString(), maxint.toString(), "Value that exceeds keyspace value should dominate it without other participants");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), web3.toWei('50', 'szabo'));
  }).then(function(res) {
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).times(5000000).toString(), "Keyspace should be %50 with two participants equaling the target difficulty");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), web3.toWei('200', 'szabo'), web3.toWei('100', 'szabo'));
  }).then(function(res) {
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).times(5000000).toString(), "Keyspace should be %50 with two partipants that double the currentdifficulty");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), web3.toWei('25', 'szabo'), web3.toWei('25', 'szabo'));
  }).then(function(res) {
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).times(2500000).toString(), "Keyspace should be %25");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), new BigNumber(web3.toWei('100', 'szabo')).dividedToIntegerBy(10000000));
  }).then(function(res) {
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000).toString(), "The smallest unit is a millionth of the current minimum difficulty");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), new BigNumber(web3.toWei('100', 'szabo')).dividedToIntegerBy(10000000).plus(1));
  }).then(function(res) {
  	  assert.equal(res.toString(), maxint.dividedToIntegerBy(10000000), "This will yield the same keyspace percentage.");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100', 'szabo'), web3.toWei('10000000', 'ether'), web3.toWei('10000000', 'ether'));
  }).then(function(res) {
  	  // 10 million ether bet, overwhelm the expected difficulty
  	  assert.equal(res.toString(), maxint.toString(), "Value dominates user keyspace");
  	  return bte.calculate_difficulty_attempt.call(web3.toWei('100000000', 'ether'), web3.toWei('10000000', 'ether'), web3.toWei('100', 'szabo'));
  }).then(function(res) {
  	  // Tiny attempt vs total keyspace and total mining
  	  assert.equal(res, 0, "Attempt should wash out under minimum divisible unit");
  });
  });

  it("should correctly return range search", function() {
  	  var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.calculate_range_attempt(web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'));
    }).then(function(res) {
    	assert.equal(res[0].toString(), web3.toWei('100', 'szabo'), "Start offset is not correct");
    	assert.equal(res[1].toString(), new BigNumber(web3.toWei('100', 'szabo')).plus(web3.toWei('100', 'szabo')), "End offset is not correct");
      return bte.calculate_range_attempt(0, 0);
	}).then(function(res) {
		assert.equal(res[0].toString(), res[1].toString(), "Start end end offset should be 0");
		return bte.calculate_range_attempt(maxint, 1);
	}).then(assert.fail)
	  .catch(function(err) {
	  	  assert(
                    err.message.indexOf('invalid opcode') >= 0,
                    'Overflow errors should result in a throw'
                )
	});

  });

  it("should correctly calculate the mining reward", function() {
  	  var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.calculate_mining_reward(0) 
    }).then(function(res) {
    	assert.equal(res.valueOf(), 50 * (10**8), "At internal block 0, we reward 50 Bitcoineum");
    	return bte.calculate_mining_reward(1)
	}).then(function(res) {
    	assert.equal(res.valueOf(), 50 * (10**8), "At internal block 0, we reward 50 Bitcoineum");
    	return bte.calculate_mining_reward(210000)
	}).then(function(res) {
		assert.equal(res.valueOf(), 50 * (10**8), "50 Bitcoineum up until block 210000");
    	return bte.calculate_mining_reward(210001)
	}).then(function(res) {
		assert.equal(res.valueOf(), 25 * (10**8), "25 Bitcoineum immediately after block 210000");
    	return bte.calculate_mining_reward(420001);
	}).then(function(res) {
		assert.equal(res.valueOf(), 12.5 * (10**8), "12.5 Bitcoineum immediately after block 410000");
	});

});

  it("should correctly calculate next expected wei on difficulty adjustment", function() {
  	  var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.calculate_next_expected_wei(web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), 4)
    }).then(function(res) {
    	assert.equal(res.toString(), web3.toWei('100', 'szabo'), "Difficulty remains constant if expected wei is equivalent ot committed wei");
    	return bte.calculate_next_expected_wei(web3.toWei('200', 'szabo'), web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), 4);
	}).then(function(res) {
		assert.equal(res.toString(), web3.toWei('200', 'szabo'), "Difficulty should scale up if wei committed is greater than expected.");
    	return bte.calculate_next_expected_wei(web3.toWei('500', 'szabo'), web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), 4);
  }).then(function(res) {
  	  assert.equal(res.toString(), web3.toWei('400', 'szabo'), "Difficulty expansion should be capped at multiple of expected wei");
  	  return bte.calculate_next_expected_wei(web3.toWei('150', 'szabo'), web3.toWei('200', 'szabo'), web3.toWei('100', 'szabo'), 4);
  }).then(function(res) {
		assert.equal(res.toString(), web3.toWei('150', 'szabo'), "Difficulty should scale down if wei committed is less than expected.");
    	return bte.calculate_next_expected_wei(web3.toWei('200', 'szabo'), web3.toWei('1000', 'szabo'), web3.toWei('100', 'szabo'), 4);
}).then(function(res) {
	assert.equal(res.toString(), web3.toWei('250', 'szabo'), "Difficulty should be prevented from falling too far during readjustment.");
    return bte.calculate_next_expected_wei(web3.toWei('50', 'szabo'), web3.toWei('100', 'szabo'), web3.toWei('100', 'szabo'), 4);
}).then(function(res) {
	assert.equal(res.toString(), web3.toWei('100', 'szabo'), "Minimum difficulty should not fall under 100 szabo");
});
});

  it("should calculate the target block number for a mining window", function() {
  	  var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.targetBlockNumber(1) 
    }).then(function(res) {
    	assert.equal(res.valueOf(), 20, "The block matures at the beginning of the next window");
      return bte.targetBlockNumber(3969300);
  }).then(function(res) {
  	  assert.equal(res.valueOf(), 3969301*10, "Block matures in the next window");
  });
});

  it("should check block maturity", function() {
  	var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
      return bte.checkBlockMature(1, 20) 
    }).then(function(res) {
	   assert.isTrue(res)
	  return bte.checkBlockMature(1, 11)
	}).then(function(res) {
		assert.isFalse(res);
	  return bte.checkBlockMature(1000, 11000)
	}).then(function(res) {
		assert.isTrue(res);
	});
  });

  it("should validate the redemption window", function() {
  	var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
    	return bte.checkRedemptionWindow(1, 10); 
    }).then(function(res) {
    	assert.isFalse(res);
    	return bte.checkRedemptionWindow(100, 1010); 
	}).then(function(res) {
		assert.isTrue(res);
    	return bte.checkRedemptionWindow(100, 1265, "At threshold"); 
	}).then(function(res) {
		assert.isTrue(res);
    	return bte.checkRedemptionWindow(100, 1266, "Pass threshold"); 
	}).then(function(res) {
		assert.isFalse(res);
	});

	});

  it("should reject an invalid mining attempt", function() {
  	var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
    	return bte.checkMiningAttempt(1, "0x1b66cad21e9f4fb07ecb32fe5e5928415b8348a2"); 
    }).then(function(res) {
    	assert.isFalse(res);
    	return bte.checkMiningAttempt(maxint, "0x1b66cad21e9f4fb07ecb32fe5e5928415b8348a2"); 
	}).then(function(res) {
		assert.isFalse(res);
	});
  });

	/* We tested individual static functions above
	*  but just to be thorough let's grab the total relevant
	* initial state atomically via getContractState
	*/
  it("should have a specific initial contract state", function() {
  	var bte;
    return Bitcoineum.deployed().then(function(instance) {
    	bte = instance;
    	return bte.getContractState(); 
    }).then(function(res) {
    	currentDifficultyWei = res[0];
        minimumDifficultyThresholdWei = res[1];
        blockNumber = res[2];
        blockCreationRate = res[3];
        difficultyAdjustmentPeriod = res[4];
        rewardAdjustmentPeriod = res[5];
        lastDifficultyAdjustmentEthereumBlock = res[6];
        totalBlocksMined = res[7];
        totalWeiCommitted = res[8];
        totalWeiExpected = res[9];
        blockTargetDifficultyWei = res[10];
        blockTotalMiningWei = res[11];
        blockCurrentAttemptOffset = res[12];
        assert.equal(currentDifficultyWei, web3.toWei('100', 'szabo'));
        assert.equal(minimumDifficultyThresholdWei, web3.toWei('100', 'szabo'));
        assert.notEqual(blockNumber.valueOf(), 1); // default block before mining commenced and window jumps
        assert.equal(blockCreationRate.valueOf(), 10);
        assert.equal(difficultyAdjustmentPeriod.valueOf(), 2016);
        assert.equal(rewardAdjustmentPeriod.valueOf(), 210000);
        assert.notEqual(lastDifficultyAdjustmentEthereumBlock.valueOf(), 1);
        assert.equal(totalBlocksMined.valueOf(), 0);
        assert.equal(totalWeiCommitted.valueOf(), 0);
        assert.equal(totalWeiExpected.toString(), new BigNumber(web3.toWei('100', 'szabo')).times(2016)); // Entire adjustment window wei expected, i.e 2016 internal blocks with the current expected wei per block
        assert.equal(blockTargetDifficultyWei.toString(), web3.toWei('100', 'szabo'));
        assert.equal(blockTotalMiningWei.valueOf(), 0);
        assert.equal(blockCurrentAttemptOffset.valueOf(), 0);
	});
  });

});
