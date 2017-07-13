pragma solidity ^0.4.13;

import 'zeppelin-solidity/contracts/token/StandardToken.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


/**
 * @title ERC20Mineable
 * @dev Coin creation through mining as a game of chance
 * @dev Mimics the Bitcoin coin creation process
 * @dev Whitepaper: http://www.bitcoineum.com/assets/Bitcoineum.pdf
 */

contract ERC20Mineable is StandardToken, ReentrancyGuard  {
   
   /** totalSupply in StandardToken refers to currently available supply
   * maximumSupply refers to the cap on mining.
   * When mining is finished totalSupply == maximumSupply
   */
   uint public maximumSupply;

   // Current mining difficulty in Wei
   uint public currentDifficultyWei;

   // Minimum difficulty
   uint public minimumDifficultyThresholdWei;

   /** Block creation rate as number of Ethereum blocks per mining cycle
   * 10 minutes at 17 seconds a block would be an internal block
   * generated every 35 Ethereum blocks
   */
   uint public blockCreationRate;

   /* difficultyAdjustmentPeriod should be every two weeks, or
   * 2016 internal blocks.
   */
   uint public difficultyAdjustmentPeriod;

   /* When was the last time we did a difficulty adjustment.
   * In case mining ceases for indeterminate duration
   */
   uint public lastDifficultyAdjustmentEthereumBlock;

   // Scale multiplier limit for difficulty adjustment
   uint public constant difficultyScaleMultiplierLimit = 4;

   // Total blocks mined helps us calculate the current reward
   uint public totalBlocksMined;

   // Reward adjustment period in Bitcoineum native blocks

   uint public rewardAdjustmentPeriod; 

   // Total amount of Wei put into mining during current period
   uint public totalWeiCommitted;
   // Total amount of Wei expected for this mining period
   uint public totalWeiExpected;

   /* The block when the contract goes active
   *  So we can calculate the internal block correctly
   */
   uint genesisBlock;

   // Where to burn Ether
   address public burnAddress;

   /** Each block is created on a mining attempt if
   * it does not already exist.
   * this keeps track of the target difficulty at the time of creation
   */

   struct InternalBlock {
      uint targetDifficultyWei;
      uint blockNumber;
      uint totalMiningWei;
      uint totalMiningAttempts;
      uint currentAttemptOffset;
      bool payed;
      address payee;
      bool isCreated;
   }

   /** Mining attempts are given a projected offset to minimize
   * keyspace overlap to increase fairness by reducing the redemption
   * race condition
   * This does not remove the possibility that two or more miners will
   * be competing for the same award, especially if subsequent increases in
   * wei from a single miner increase overlap
   */
   struct MiningAttempt {
      uint projectedOffset;
      uint value;
      bool isCreated;
   }

   // Each guess gets assigned to a block
   mapping (uint => InternalBlock) public blockData;
   mapping (uint => mapping (address => MiningAttempt)) public miningAttempts;

   // Utility related

   function current_external_block() public constant returns (uint256) {
       return block.number;
   }

   function external_to_internal_block_number(uint _externalBlockNum) public constant returns (uint) {
      // blockCreationRate is > 0
      return _externalBlockNum / blockCreationRate;
   }

   // For the test harness verification
   function get_internal_block_number() public constant returns (uint256) {
     return external_to_internal_block_number(current_external_block());
   }

   // Initial state related
   /** Dapps need to grab the initial state of the contract
   * in order to properly initialize mining or tracking
   * this is a single atomic function for getting state
   * rather than scattering it across multiple public calls
   * also returns the current blocks parameters
   * or default params if it hasn't been created yet
   * This is only called externally
   */

   function getContractState() external constant
     returns (uint,  // currentDifficultyWei
              uint,  // minimumDifficultyThresholdWei
              uint,  // blockNumber
              uint,  // blockCreationRate
              uint,  // difficultyAdjustmentPeriod
              uint,  // rewardAdjustmentPeriod
              uint,  // lastDifficultyAdustmentEthereumBlock
              uint,  // totalBlocksMined
              uint,  // totalWeiCommitted
              uint,  // totalWeiExpected
              uint,  // b.targetDifficultyWei
              uint,  // b.totalMiningWei
              uint  // b.currentAttemptOffset
              ) {
    InternalBlock memory b;
    uint _blockNumber = external_to_internal_block_number(current_external_block());
    if (!blockData[_blockNumber].isCreated) {
        b = InternalBlock(
                       {targetDifficultyWei: currentDifficultyWei,
                       blockNumber: _blockNumber,
                       totalMiningWei: 0,
                       totalMiningAttempts: 0,
                       currentAttemptOffset: 0,
                       payed: false,
                       payee: 0,
                       isCreated: true
                       });
    } else {
         b = blockData[_blockNumber];
    }
    return (currentDifficultyWei,
            minimumDifficultyThresholdWei,
            _blockNumber,
            blockCreationRate,
            difficultyAdjustmentPeriod,
            rewardAdjustmentPeriod,
            lastDifficultyAdjustmentEthereumBlock,
            totalBlocksMined,
            totalWeiCommitted,
            totalWeiExpected,
            b.targetDifficultyWei,
            b.totalMiningWei,
            b.currentAttemptOffset);
   }

   // Mining Related

   modifier blockCreated(uint _blockNum) {
     require(blockData[_blockNum].isCreated);
     _;
   }

   modifier blockRedeemed(uint _blockNum) {
     require(_blockNum != current_external_block());
     /* Should capture if the blockdata is payed
     *  or if it does not exist in the blockData mapping
     */
     require(blockData[_blockNum].isCreated);
     require(!blockData[_blockNum].payed);
     _;
   }

   modifier initBlock(uint _blockNum) {
     require(_blockNum != current_external_block());

     if (!blockData[_blockNum].isCreated) {
       // Create new block for tracking
       blockData[_blockNum] = InternalBlock(
                                     {targetDifficultyWei: currentDifficultyWei,
                                      blockNumber: _blockNum,
                                      totalMiningWei: 0,
                                      totalMiningAttempts: 0,
                                      currentAttemptOffset: 0,
                                      payed: false,
                                      payee: 0,
                                      isCreated: true
                                      });
     }
     _;
   }

   modifier isValidAttempt() {
     /* If the Ether for this mining attempt is less than minimum
     * 0.001 % of total difficulty
     */
     uint minimum_wei = currentDifficultyWei / 10000000; 
     require (msg.value >= minimum_wei);

     /* Let's bound the value to guard against potential overflow
     * i.e max int, or an underflow bug
     * This is a single attempt
     */
     require(msg.value <= (1000000 ether));
     _;
   }

   modifier alreadyMined(uint blockNumber, address sender) {
     require(blockNumber != current_external_block()); 
    /* We are only going to allow one mining attempt per block per account
    *  This prevents stuffing and make it easier for us to track boundaries
    */
    
    // This user already made a mining attempt for this block
    require(!checkMiningAttempt(blockNumber, sender));
    _;
   }

   modifier isMiningActive() {
      // Check if mining is over
      require(totalSupply < maximumSupply);
      _;
   }

   function burn(uint value) internal {
      /* We don't really care if the burn fails for some
      *  weird reason.
      */
      bool ret = burnAddress.send(value);
      /* If we cannot burn this ether, than the contract might
      *  be under some kind of stack attack.
      *  Even though it shouldn't matter, let's err on the side of
      *  caution and throw in case there is some invalid state.
      */
      require (ret);
   }

   event MiningAttemptEvent(
       address indexed _from,
       uint _value,
       uint indexed _blockNumber,
       uint _totalMinedWei,
       uint _targetDifficultyWei
   );

   event LogEvent(
       string _info
   );

   /**
   * @dev Add a mining attempt for the current internal block
   * Initialize an empty block if not created
   * Invalidate this mining attempt if the block has been paid out
   */

   function mine() external payable 
                           nonReentrant
                           isValidAttempt
                           isMiningActive
                           initBlock(external_to_internal_block_number(current_external_block()))
                           blockRedeemed(external_to_internal_block_number(current_external_block()))
                           alreadyMined(external_to_internal_block_number(current_external_block()),
                           msg.sender) returns (bool) {
      /* Let's immediately adjust the difficulty
      *  In case an abnormal period of time has elapsed
      *  nobody has been mining etc.
      *  Will let us recover the network even if the
      * difficulty spikes to some absurd amount
      */
      adjust_difficulty();
      uint internalBlockNum = external_to_internal_block_number(current_external_block());

      miningAttempts[internalBlockNum][msg.sender] =
                     MiningAttempt({projectedOffset: blockData[internalBlockNum].currentAttemptOffset,
                                    value: msg.value,
                                    isCreated: true});

      // Increment the mining attempts for this block
      blockData[internalBlockNum].totalMiningAttempts += 1;
      blockData[internalBlockNum].totalMiningWei += msg.value;
      totalWeiCommitted += msg.value;

      /* We are trying to stack mining attempts into their relative
      *  positions in the key space.
      */
      blockData[internalBlockNum].currentAttemptOffset += msg.value;
      MiningAttemptEvent(msg.sender,
                         msg.value,
                         internalBlockNum,
                         blockData[internalBlockNum].totalMiningWei,
                         blockData[internalBlockNum].targetDifficultyWei
                         );
      // All mining attempt Ether is burned
      burn(msg.value);
      return true;
   }

   // Redemption Related

   modifier userMineAttempted(uint _blockNum, address _user) {
      require(!checkMiningAttempt(_blockNum, _user));
      _;
   }
   
   modifier isBlockMature(uint _blockNumber) {
      require(_blockNumber != current_external_block());
      require(checkBlockMature(_blockNumber, current_external_block()));
      require(checkRedemptionWindow(_blockNumber, current_external_block()));
      _;
   }

   // Just in case this block falls outside of the available
   // block range, possibly because of a change in network params
   modifier isBlockReadable(uint _blockNumber) {
      InternalBlock memory iBlock = blockData[_blockNumber];
      uint targetBlockNum = targetBlockNumber(_blockNumber);
      require(block.blockhash(targetBlockNum) != 0);
      _;
   }

   function calculate_difficulty_attempt(uint targetDifficultyWei,
                                         uint totalMiningWei,
                                         uint value) public constant returns (uint256) {
      // The total amount of Wei sent for this mining attempt exceeds the difficulty level
      // So the calculation of percentage keyspace should be done on the total wei.
      uint selectedDifficultyWei = 0;
      if (totalMiningWei > targetDifficultyWei) {
         selectedDifficultyWei = totalMiningWei;
      } else {
         selectedDifficultyWei = targetDifficultyWei; 
      }

      /* normalize the value against the entire key space
       * Multiply it out because we do not have floating point
       * 10000000 is .0000001 % increments
      */

      uint256 intermediate = ((value * 10000000) / selectedDifficultyWei);
      uint256 max_int = 0;
      // Underflow to maxint
      max_int = max_int - 1;

      if (intermediate >= 10000000) {
         return max_int;
      } else {
         return intermediate * (max_int / 10000000);
      }
   }

   function calculate_range_attempt(uint difficulty, uint offset) public constant returns (uint, uint) {
       /* Both the difficulty and offset should be normalized
       * against the difficulty scale.
       * If they are not we might have an integer overflow
       */
       require(offset + difficulty >= offset);
       return (offset, offset+difficulty);
   }

   function calculate_mining_reward(uint256 _totalBlocksMined) public constant returns (uint) {
      /* Block rewards starts at 50 Bitcoineum
      *  Every 10 minutes
      *  Block reward decreases by 50% every 210000 blocks
      */
      uint mined_block_period = 0;
      if (_totalBlocksMined < 210000) {
           mined_block_period = 210000;
      } else {
           mined_block_period = _totalBlocksMined;
      }

      // Again we have to do this iteratively because of floating
      // point limitations in solidity.
      uint total_reward = 50 * (10 ** 8); // 8 Decimals
      uint256 i = 1;
      uint256 rewardperiods = mined_block_period / 210000;
      if (mined_block_period % 210000 > 0) {
         rewardperiods += 1;
      }
      for (i=1; i < rewardperiods; i++) {
          total_reward = total_reward / 2;
      }
      return total_reward;
   }

   // Break out the expected wei calculation
   // for easy external testing
   function calculate_next_expected_wei(uint _totalWeiCommitted,
                                        uint _totalWeiExpected,
                                        uint _minimumDifficultyThresholdWei,
                                        uint _difficultyScaleMultiplierLimit) public constant
                                        returns (uint) {
          
          /* The adjustment window has been fulfilled
          *  The new difficulty should be bounded by the total wei actually spent
          * capped at difficultyScaleMultiplierLimit times
          */
          uint lowerBound = _totalWeiExpected / _difficultyScaleMultiplierLimit;
          uint upperBound = _totalWeiExpected * _difficultyScaleMultiplierLimit;

          if (_totalWeiCommitted < lowerBound) {
              _totalWeiExpected = lowerBound;
          } else if (_totalWeiCommitted > upperBound) {
              _totalWeiExpected = upperBound;
          } else {
              _totalWeiExpected = _totalWeiCommitted;
          }

          /* If difficulty drops too low lets set it to our minimum.
          *  This may halt coin creation, but obviously does not affect
          *  token transactions.
          */
          if (_totalWeiExpected < _minimumDifficultyThresholdWei) {
              _totalWeiExpected = _minimumDifficultyThresholdWei;
          }

          return _totalWeiExpected;
    }

   function adjust_difficulty() internal {
      /* Total blocks mined might not be increasing if the 
      *  difficulty is too high. So we should instead base the adjustment
      * on the progression of the Ethereum network.
      * So that the difficulty can increase/deflate regardless of sparse
      * mining attempts
      */

      if ((current_external_block() - lastDifficultyAdjustmentEthereumBlock) > (difficultyAdjustmentPeriod * blockCreationRate)) {

          // Get the new total wei expected via static function
          totalWeiExpected = calculate_next_expected_wei(totalWeiCommitted, totalWeiExpected, minimumDifficultyThresholdWei, difficultyScaleMultiplierLimit);

          // Regardless of difficulty adjustment, let us zero totalWeiCommited
          totalWeiCommitted = 0;

          // Lets reset the difficulty adjustment block target
          lastDifficultyAdjustmentEthereumBlock = current_external_block();

      }
   }

   event BlockClaimedEvent(
       address indexed _from,
       address indexed _forCreditTo,
       uint _reward,
       uint indexed _blockNumber
   );

   modifier onlyWinner(uint _blockNumber) {
      require(checkWinning(_blockNumber));
      _;
   }

   /** 
   * @dev Claim the mining reward for a given block
   * @param _blockNumber The internal block that the user is trying to claim
   * @param forCreditTo When the miner account is different from the account
   * where we want to deliver the redeemed Bitcoineum. I.e Hard wallet.
   */
   function claim(uint _blockNumber, address forCreditTo)
                  nonReentrant
                  blockRedeemed(_blockNumber)
                  isBlockMature(_blockNumber)
                  isBlockReadable(_blockNumber)
                  userMineAttempted(_blockNumber, msg.sender)
                  onlyWinner(_blockNumber)
                  external returns (bool) {
      /* If attempt is valid, invalidate redemption
      *  Difficulty is adjusted here
      *  and on bidding, in case bidding stalls out for some
      *  unusual period of time.
      *  Do everything, then adjust supply and balance
      */
      blockData[_blockNumber].payed = true;
      blockData[_blockNumber].payee = msg.sender;
      totalBlocksMined = totalBlocksMined + 1;
      adjust_difficulty();

      uint reward = calculate_mining_reward(totalBlocksMined);

      balances[forCreditTo] = balances[forCreditTo].add(reward);
      
      totalSupply += reward;
      BlockClaimedEvent(msg.sender, forCreditTo,
                        reward,
                        _blockNumber);
      // Mining rewards should show up as ERC20 transfer events
      // So that ERC20 scanners will see token creation.
      Transfer(this, forCreditTo, reward);
      return true;
   }

   /** 
   * @dev Claim the mining reward for a given block
   * @param _blockNum The internal block that the user is trying to claim
   */
   function isBlockRedeemed(uint _blockNum) constant public returns (bool) {
     if (!blockData[_blockNum].isCreated) {
         return false;
     } else {
         return blockData[_blockNum].payed;
     }
   }

   /** 
   * @dev Get the target block in the winning equation 
   * @param _blockNum is the internal block number to get the target block for
   */
   function targetBlockNumber(uint _blockNum) constant public returns (uint) {
      return ((_blockNum + 1) * blockCreationRate);
   }

   /** 
   * @dev Check whether a given block is mature 
   * @param _blockNum is the internal block number to check 
   */
   function checkBlockMature(uint _blockNum, uint _externalblock) constant public returns (bool) {
     return (_externalblock >= targetBlockNumber(_blockNum));
   }

   /**
   * @dev Check the redemption window for a given block
   * @param _blockNum is the internal block number to check
   */

   function checkRedemptionWindow(uint _blockNum, uint _externalblock) constant public returns (bool) {
       uint _targetblock = targetBlockNumber(_blockNum);
       return _externalblock >= _targetblock && _externalblock < (_targetblock + 256);
   }

   /** 
   * @dev Check whether a mining attempt was made by sender for this block
   * @param _blockNum is the internal block number to check
   */
   function checkMiningAttempt(uint _blockNum, address _sender) constant public returns (bool) {
       return miningAttempts[_blockNum][_sender].isCreated;
   }

   /** 
   * @dev Did the user win a specific block and can claim it?
   * @param _blockNum is the internal block number to check
   */
   function checkWinning(uint _blockNum) constant public returns (bool) {
     if (checkMiningAttempt(_blockNum, msg.sender) && checkBlockMature(_blockNum, current_external_block())) {

      InternalBlock memory iBlock = blockData[_blockNum];
      uint targetBlockNum = targetBlockNumber(iBlock.blockNumber);
      MiningAttempt memory attempt = miningAttempts[_blockNum][msg.sender];

      uint difficultyAttempt = calculate_difficulty_attempt(iBlock.targetDifficultyWei, iBlock.totalMiningWei, attempt.value);
      uint beginRange;
      uint endRange;
      uint256 targetBlockHashInt;

      (beginRange, endRange) = calculate_range_attempt(difficultyAttempt,
          calculate_difficulty_attempt(iBlock.targetDifficultyWei, iBlock.totalMiningWei, attempt.projectedOffset)); 
      targetBlockHashInt = uint256(sha256(block.blockhash(targetBlockNum)));
   
      // This is the winning condition
      if ((beginRange < targetBlockHashInt) && (endRange >= targetBlockHashInt))
      {
        return true;
      }
     
     }

     return false;
     
   }

}

