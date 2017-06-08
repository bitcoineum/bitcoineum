pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/StandardToken.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'zeppelin-solidity/contracts/SafeMath.sol';


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

   // Current Internal Block counter
   uint public blockNumber;

   // Block creation rate as number of Ethereum blocks per mining cycle
   // 10 minutes at 17 seconds a block would be an internal block
   // generated every 35 Ethereum blocks
   uint public blockCreationRate;

   // difficultyAdjustmentPeriod should be every two weeks, or
   // 2016 blocks.
   uint public difficultyAdjustmentPeriod;

   // Total blocks mined helps us calculate the current reward
   uint public totalBlocksMined;

   // Total amount of Wei put into mining during current period
   uint public totalWeiCommitted;
   // Total amount of Wei expected for this mining period
   uint public totalWeiExpected;


   // Where to burn Ether
   address burnAddress;

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
   mapping (uint => InternalBlock) private blockData;
   mapping (uint => mapping (address => MiningAttempt)) private miningAttempts;

   // Utility related

   function external_to_internal_block_number(uint _externalBlockNum) returns (uint) {
      return SafeMath.div(_externalBlockNum, blockCreationRate); 
   }

   function calculate_maturation_block(uint _externalBlockNum) returns (uint) {
      uint internalBlock = external_to_internal_block_number(_externalBlockNum);
      return ((internalBlock+1) * blockCreationRate);
   }

   // Mining Related

   modifier blockCreated(uint blockNum) {
     if (blockData[blockNum].isCreated) {
       throw;
     }
     _;
   }

   modifier blockRedeemed(uint _blockNum) {
     require(_blockNum != block.number);
     // Should capture if the blockdata is payed
     // or if it does not exist in the blockData mapping
     if (blockData[_blockNum].payed) {
        throw;
     }
     _;
   }


   modifier initBlock(uint _blockNum) {
     require(_blockNum != block.number);

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
     // If the Ether for this mining attempt is less than minimum
     // 0.001 % of total difficulty
     uint minimum_wei = SafeMath.div(currentDifficultyWei, 1000); 
     if (msg.value < minimum_wei) {
        throw;
     }
     _;
   }

   modifier alreadyMined(uint blockNumber, address sender) {
     require(blockNumber != block.number); 
    // We are only going to allow one mining attempt per block per account
    // This prevents stuffing and make it easier for us to track boundaries
    uint internalBlockNum = external_to_internal_block_number(block.number);
    if (miningAttempts[internalBlockNum][sender].isCreated) {
       // This user already made a mining attempt for this block
       throw;
    }
    _;
   }

   modifier isMiningActive() {
      if (totalSupply >= maximumSupply) {
         // Mining is over
         throw;
      }
      _;
   }

   function burn(uint value) internal {
      // We don't really care if the burn fails for some
      // weird reason.
      bool ret = burnAddress.send(value);
      if (ret) {
        // Do absolutely nothing
      }
   }

   event MiningAttemptEvent(
       address indexed _from,
       uint _value,
       uint _blockNumber,
       uint _totalMinedWei
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
                           initBlock(external_to_internal_block_number(block.number))
                           blockRedeemed(external_to_internal_block_number(block.number))
                           alreadyMined(external_to_internal_block_number(block.number), msg.sender) returns (bool) {
      uint internalBlockNum = external_to_internal_block_number(block.number);

      miningAttempts[internalBlockNum][msg.sender] =
                     MiningAttempt({projectedOffset: blockData[internalBlockNum].currentAttemptOffset,
                                    value: msg.value,
                                    isCreated: true});

      // Increment the mining attempts for this block
      blockData[internalBlockNum].totalMiningAttempts += 1;
      blockData[internalBlockNum].totalMiningWei += msg.value;
      totalWeiCommitted += msg.value;

      // We are trying to stack mining attempts into their relative
      // positions in the key space.
      blockData[internalBlockNum].currentAttemptOffset += msg.value;
      MiningAttemptEvent(msg.sender,
                         msg.value,
                         internalBlockNum,
                         blockData[internalBlockNum].totalMiningWei);
      // All mining attempt Ether is burned
      burn(msg.value);
      return true;
   }

   // Redemption Related

   modifier userMineAttempted(uint _blockNum, address _user) {
      if (!miningAttempts[_blockNum][_user].isCreated) {
         throw;
      }
      _;
   }

   modifier isBlockMature(uint _blockNumber) {
      require(_blockNumber != block.number);

      // Is the block mature
      if (block.number < (_blockNumber * blockCreationRate)) {
         throw;
      }

      // Is the block inside the redemption window
      // We cannot look up anything past the previous 256 blocks
      // which means we have an limited redemption window for block rewards
      if (block.number >= ((_blockNumber * blockCreationRate) + 256)) {
         throw;
      }
      _;
   }

   function calculate_difficulty_attempt(InternalBlock b,
                                         uint value) internal returns (uint) {
      // The total amount of Wei sent for this mining attempt exceeds the difficulty level
      // So the calculation of percentage keyspace should be done on the total wei.
      uint selectedDifficultyWei = 0;
      if (b.totalMiningWei > b.targetDifficultyWei) {
         selectedDifficultyWei = b.totalMiningWei;
      } else {
         selectedDifficultyWei = b.targetDifficultyWei; 
      }

      // normalize the value against the entire key space
      return (( value / selectedDifficultyWei) * (2 ** 256 - 1));
   }

   function calculate_range_attempt(uint difficulty, uint offset) internal returns (uint, uint) {
       // Both the difficulty and offset should be normalized
       // against the difficulty scale.
       // If they are not we might have an integer overflow
       if (offset + difficulty <  offset) {
          throw;
        }

        return (offset, offset+difficulty);
   }

   function calculate_mining_reward() internal returns (uint) {
      // Block reward decreases by 50% every 210000 blocks
      return (50 ** (totalBlocksMined / 210000));
   }

   function adjust_difficulty() internal {
      // Total blocks mined might not be increasing if the 
      // difficulty is too high. So we should instead base the adjustment
      // on the progression of the Ethereum network.

      if ((block.number % (difficultyAdjustmentPeriod * blockCreationRate)) == 0) {
          // The adjustment window has been fulfilled

          // The new difficulty should be bounded by the total wei actually spent
          // capped at 4 times

          uint lowerBound = totalWeiExpected / 4;
          uint upperBound = totalWeiExpected * 4;

          if (totalWeiCommitted < lowerBound) {
              totalWeiExpected = lowerBound;
          }

          if (totalWeiCommitted > upperBound) {
              totalWeiExpected = upperBound;
          }

          // If difficulty drops too low lets set it to our minimum.
          // This may halt coin creation, but obviously does not affect
          // token transactions.
          if (totalWeiExpected < minimumDifficultyThresholdWei) {
              totalWeiExpected = minimumDifficultyThresholdWei;
          }

          // Regardless of difficulty adjustment, let us totalWeiCommited
          totalWeiCommitted = 0;
      }
   }

   event BlockClaimedEvent(
       address indexed _from,
       uint _reward,
       uint _blockNumber
   );

   /** 
   * @dev Claim the mining reward for a given block
   * @param _blockNumber The internal block that the user is trying to claim
   */
   function claim(uint _blockNumber)
                  nonReentrant
                  blockRedeemed(_blockNumber)
                  isBlockMature(_blockNumber)
                  userMineAttempted(_blockNumber, msg.sender) external returns (bool) {
      // If this block has not been redeemed, we need to check if
      // the caller is the winner
      InternalBlock iBlock = blockData[_blockNumber];
      uint targetBlockNum = iBlock.blockNumber * blockCreationRate;
      if (block.blockhash(targetBlockNum) == 0) {
         throw;
      }

      MiningAttempt attempt = miningAttempts[_blockNumber][msg.sender];

      // Calualate normalized mining attempt Ether difficulty

      uint difficultyAttempt = calculate_difficulty_attempt(iBlock, attempt.value);

      // Add this normalized difficulty to the projected offset for the mining attempt

      uint beginRange;
      uint endRange;

      (beginRange, endRange) = calculate_range_attempt(difficultyAttempt,
          calculate_difficulty_attempt(iBlock, attempt.projectedOffset)); 

      // Determine whether attempt is valid
    
      uint256 targetBlockHashInt = uint256(sha256(block.blockhash(targetBlockNum)));

      if ((beginRange < targetBlockHashInt) && (endRange >= targetBlockHashInt)) {
        // This was a successul mining attempt
        // Give the current reward to the miner
      } else {
        // User is trying to redeem a reward they are not entitled to
        throw;
      }

      // If attempt is valid, invalidate redemption, adjust difficulty
      // Do everything, then adjust supply and balance
      blockData[_blockNumber].payed = true;
      blockData[_blockNumber].payee = msg.sender;
      totalBlocksMined = totalBlocksMined + 1;
      adjust_difficulty();
      balances[msg.sender] = balances[msg.sender].add(calculate_mining_reward());
      totalSupply += calculate_mining_reward();
      BlockClaimedEvent(msg.sender, calculate_mining_reward(), _blockNumber);
      return true;
   }

}

