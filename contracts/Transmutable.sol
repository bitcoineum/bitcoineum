pragma solidity ^0.4.13;

/**
 * @title Transmutable
 * @dev A transmutable token allows the token to convert
 * @dev into a token that supports the transmutable interface.
 * @dev Contrast with wrapped token
 */

// Contracts that can be converted into other sourced of value
// should implement this.
contract Transmutable {
  function transmute(address to, uint256 value) returns (bool, uint256);
  event Transmuted(address indexed who, address baseContract, address transmutedContract, uint256 sourceQuantity, uint256 destQuantity);
}

// Contracts that can be transmuted to should implement this
contract TransmutableInterface {
  function transmuted(uint256 _value) returns (bool, uint256);
}
