// AXFLOToken.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.9.0/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AXFLOToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 15_000_000 * 1e18;
    uint256 public constant SALE_GOAL = 5_000_000 * 1e18;
    
    uint256 public currentPrice = 0.002 ether; // 1 AXFLO = 0.002 ETH
    uint256 public totalSold;
    address payable public treasury;

    event TokensPurchased(address buyer, uint256 ethAmount, uint256 axfloAmount);

    constructor(address _treasury) ERC20("TraxFlow Token", "AXFLO") {
        treasury = payable(_treasury);
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function buyAXFLO() external payable {
        require(totalSold < SALE_GOAL, "Sale completed");
        uint256 axfloAmount = (msg.value * 1e18) / currentPrice;
        
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "ETH transfer failed");
        
        _transfer(owner(), msg.sender, axfloAmount);
        totalSold += axfloAmount;
        
        emit TokensPurchased(msg.sender, msg.value, axfloAmount);
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        currentPrice = newPrice;
    }
}