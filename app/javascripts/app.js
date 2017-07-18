import "../stylesheets/app.css";
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'
import EthereumBlocks from 'ethereum-blocks'
import BigNumber from 'bignumber.js'

import bitcoineum_artifacts from '../../build/contracts/Bitcoineum.json'

import BitcoineumMiner from './bitcoineum_miner';

import SimpleConsole from './simple-console';

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
		self.setupWebConsole();

		});
  },

  setStatus: function(message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  setupWebConsole: function() {
  	  var con = new SimpleConsole({
  	  	  handleCommand: handle_command,
  	  	  placeholder: "Enter Miner Command, help for more information",
  	  	  storageID: "bitcoineum-miner"
  	  });
  	 document.body.appendChild(con.element);

     con.logHTML(
     	"<h1>Bitcoineum Console Miner 0.3 </a></h1>"
     );


	self.miner = new BitcoineumMiner(account, con.log);

    function handle_command(command){
    	// Conversational trivialities
    	var log_emoji = function(face, rotate_direction){
    		// top notch emotional mirroring
    		var span = document.createElement("span");
    		span.style.display = "inline-block";
    		span.style.transform = "rotate(" + (rotate_direction / 4) + "turn)";
    		span.style.cursor = "vertical-text";
    		span.style.fontSize = "1.3em";
    		span.innerText = face.replace(">", "〉").replace("<", "〈");
    		con.log(span);
    	};
    	
    	// Let's run through all of our supported commands
    	//
    	if(command.match(/^(stats?|statistics?)/i)) {
    		self.miner.printStats();
		} else if(command.match(/^(config|configuration)/i)) {
			self.miner.printConfig();
		} else if(command.match(/^automine/i)) {
			self.miner.autoMine();
		} else if(command.match(/^debug/i)) {
			self.miner.toggleDebug();
		} else if(command.match(/^set-mining-account/i)) {
			let selectedAccount = command.match(/(0x)?[0-9a-f]{40}/i);
			if (selectedAccount) {
				self.miner.set_mining_account(selectedAccount[0]);
			} else {
				con.log("missing valid account");
			}
		} else if(command.match(/^set-credit-account/i)) {
			let selectedAccount = command.match(/(0x)?[0-9a-f]{40}/i);
			if (selectedAccount) {
				self.miner.set_credit_account(selectedAccount[0]);
			} else {
				con.log("missing valid account");
			}
		} else if(command.match(/^set-max-spend/i)) {
			let wei = command.match(/\d+/i);
			self.miner.set_max_spend_value(wei);
		} else if(command.match(/^set-max-attempt/i)) {
			let wei = command.match(/\d+/i);
			self.miner.set_max_attempt_value(wei);
		} else if(command.match(/^set-percentage-attempt/i)) {
			let percentage = parseInt(command.match(/\d?\d?\d/i)[0]);
			self.miner.set_attempt_percentage(percentage/100);
		} else if(command.match(/^(!*\?+!*|(please |plz )?(((I )?(want|need)[sz]?|display|show( me)?|view) )?(the |some )?help|^(gimme|give me|lend me) ((the |some )?)help| a hand( here)?)/i)){
    		con.log("Bitcoineum Miner Help ");
    		con.log("stats -- Display current miner stats");
    		con.log("config -- Display configuration information");
    		con.log("automine -- Start/Stop mining (Requires unlocked local account");
    		con.log("set-mining-account account -- Sets the mining account, must be an unlocked local account");
    		con.log("set-credit-account account -- Credits rewarded blocks to account, i.e a hardware wallet.");
    		con.log("set-max-spend wei -- Stop mining after this amount has been consumed");
    		con.log("set-max-attempt wei -- An individual mining attempt will be capped at this value");
    		con.log("set-percentage-attempt % -- %100 sets the attempt to the CurrentDifficulty of the block");
    		con.log("debug -- Enable/Disable debug events");
    	}else{
    		var err;
    		try{
    			var result = eval(command);
    		}catch(error){
    			err = error;
    		}
    		if(err){
    			con.error(err);
    		}else{
    			con.log(result).classList.add("result");
    		}
    	}
    };
  }

}

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
