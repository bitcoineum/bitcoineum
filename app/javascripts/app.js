import "../stylesheets/app.css";
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

import bitcoineum_artifacts from '../../build/contracts/Bitcoineum.json'

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

      self.refreshStats();
    });
  },

  setStatus: function(message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  refreshStats: function() {
    var self = this;

    var bte;
    Bitcoineum.deployed().then(function(instance) {
      bte = instance;
      return Promise.all([bte.balanceOf.call(account, {from: account}),
                          bte.blockNumber.call(),
                          bte.currentDifficultyWei.call(),
                          bte.totalWeiExpected.call()]);
    }).then(function([balance, block, currentDiff, expectedDiff]) {
      var balance_element = document.getElementById("balance");
      var block_element = document.getElementById("bte_block");
      var bte_difficulty_element = document.getElementById("bte_difficulty");
      var bte_expected_element = document.getElementById("bte_expected");
      balance_element.innerHTML = balance.valueOf();
      block_element.innerHTML = block.valueOf();
      bte_difficulty_element.innerHTML = currentDiff.valueOf();
      bte_expected.innerHTML = expectedDiff.valueOf();
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error getting balance; see log.");
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
