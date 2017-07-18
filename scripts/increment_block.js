function nextblock() {
	for (var i=0; i<10; i++) {
		web3.eth.sendTransaction({from:'0xdf08f82de32b8d460adbe8d72043e3a7e25a3b39', to: '0xdf08f82de32b8d460adbe8d72043e3a7e25a3b38', value: 100000})
	}
}

nextblock();
process.exit();
