import "../stylesheets/app.css";
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'
import EthereumBlocks from 'ethereum-blocks'
import BigNumber from 'bignumber.js'

import bitcoineum_artifacts from '../../build/contracts/Bitcoineum.json'

import BitcoineumMiner from './bitcoineum_miner';

var Bitcoineum = contract(bitcoineum_artifacts);
var accounts;
var account;

window.App = {
  start: function() {
    var self = this;


    Bitcoineum.setProvider(web3.currentProvider);

    // Get the initial account balance so it can be displayed.
    web3.eth.getAccounts(function(err, accs) {
      if (err != null) {
        alert("There was an error fetching your accounts.");
        return;
      }

      if (accs.length == 0) {
        alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
        return;
      }

      accounts = accs;
      account = accounts[0];
      
      console.log("Starting Bitcoineum Miner...");
      self.miner = new BitcoineumMiner(account);

      console.log("Using account: " + account);
      self.refreshStats();
      self.watchMiningAttempts();

    });
  },

  setStatus: function(message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  watchMiningAttempts: function() {

  	  var self = this;
  	  var bte;
  	  Bitcoineum.deployed().then(function(instance) {
  	  	  bte = instance;
  	  	  var event = bte.MiningAttemptEvent();
  	  	  event.watch(function(error, response) {
  	  	  	  console.log("Got mining attempt event");
  	  	  	  console.log(response.args._from);
  	  	  	  console.log(response.args._value.toString());
  	  	  	  console.log(response.args._blockNumber.toString());
  	  	  	  console.log(response.args._totalMinedWei.toString());
		  });
	  });
  },

  calculateMinimumDifficultyWei: function(CurrentDifficulty) {
  	  return BigNumber.new(currentDifficulty).divideBy(1000);
  },

  watchBlocks: function() {
  	  const blocks = new EthereumBlocks({ web3: web3 });
  	  // register a handler called "myHandler" 
      blocks.registerHandler('myHandler', (eventType, blockId, data) => {
        switch (eventType) {
          case 'block':
            /* data = result of web3.eth.getBlock(blockId) */
            console.log('Block id', blockId);
            console.log('Block nonce', data.nonce);
            console.log('Block number', data.number);
            break;
          case 'error':
            /* data = Error instance */
            console.error(data);
            break;
        }
      });
      blocks.start().catch(console.error);
  },

  refreshStats: function() {
    var self = this;

    var bte;
    Bitcoineum.deployed().then(function(instance) {
      bte = instance;
      return Promise.all([bte.balanceOf.call(account, {from: account}),
                          bte.blockNumber.call(),
                          bte.currentDifficultyWei.call(),
                          bte.totalWeiExpected.call(),
                          bte.totalWeiCommitted.call()]);
    }).then(function([balance, block, currentDiff, expectedDiff, committedWei]) {
      var balance_element = document.getElementById("balance");
      var block_element = document.getElementById("bte_block");
      var bte_difficulty_element = document.getElementById("bte_difficulty");
      var bte_expected_element = document.getElementById("bte_expected");
      var bte_committed_element = document.getElementById("bte_committed");
      balance_element.innerHTML = balance.valueOf();
      block_element.innerHTML = block.valueOf();
      bte_difficulty_element.innerHTML = web3.fromWei(currentDiff.valueOf(), 'ether');
      bte_expected_element.innerHTML = web3.fromWei(expectedDiff.valueOf(), 'ether');
      bte_committed_element.innerHTML = web3.fromWei(committedWei.valueOf(), 'ether');
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error getting balance; see log.");
    });
  },

  mine: function() {
  	  var self = this;
  	  var amount = parseInt(document.getElementById("attempt_amount").value);
  	  
  	  var bte;
  	  Bitcoineum.deployed().then(function(instance) {
  	  	  bte = instance;
  	  	  return bte.mine({from: account, value: amount});
	  }).then(function() {
	  	  console.log("Mining attempt made!");
  	  }).catch(function(e) {
  	  	  console.log(e);
	  });
  },

  claim: function() {
  	  var self = this;
  	  var block_number = parseInt(document.getElementById("claim_block_number").value);
  	  
  	  var bte;
  	  Bitcoineum.deployed().then(function(instance) {
  	  	  bte = instance;
  	  	  return bte.claim(block_number, {from: account});
	  }).then(function() {
	  	  console.log("Claimed Bitcoineum");
	  }).catch(function(e) {
	  	  console.log(e)
	  });
  },

  check: function() {
  	  var self = this;
  	  var block_number = parseInt(document.getElementById("check_block_number").value);
  	  var bte;

  	  Bitcoineum.deployed().then(function(instance) {
  	  	  bte = instance;
  	  	  return bte.stats.call(block_number, {from: account});
	  }).then(function(res) {
	  	  console.log("Who won?");
	  	  console.log(res.toString());
	  }).catch(function(e) {
	  	  console.log(e)
	  });
  },


  sendCoin: function() {
    var self = this;

    var amount = parseInt(document.getElementById("amount").value);
    var receiver = document.getElementById("receiver").value;

    this.setStatus("Initiating transaction... (please wait)");

    var meta;
    Bitcoineum.deployed().then(function(instance) {
      meta = instance;
      return meta.sendCoin(receiver, amount, {from: account});
    }).then(function() {
      self.setStatus("Transaction complete!");
      self.refreshBalance();
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error sending coin; see log.");
    });
  }
};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  App.start();
});
