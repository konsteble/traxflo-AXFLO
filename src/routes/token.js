const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const AXFLOToken = require('../contracts/polygon/AXFLOToken.json');

const provider = new ethers.JsonRpcProvider(`https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`);
const tokenAddress = "0x..."; // Адрес вашего развернутого контракта
const tokenAbi = AXFLOToken.abi;

// Получение информации о продажах
router.get('/sale-info', async (req, res) => {
  try {
    const contract = new ethers.Contract(tokenAddress, tokenAbi, provider);
    const [totalSold, currentPrice, saleGoal] = await Promise.all([
      contract.totalSold(),
      contract.getCurrentPrice(),
      contract.SALE_GOAL()
    ]);
    
    res.json({
      totalSold: ethers.formatEther(totalSold),
      currentPrice: ethers.formatEther(currentPrice),
      saleGoal: ethers.formatEther(saleGoal),
      progress: (totalSold * 10000n / saleGoal) / 100 // Процент проданных токенов
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Покупка токенов
router.post('/buy', async (req, res) => {
  try {
    const { usdtAmount, buyerAddress } = req.body;
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(tokenAddress, tokenAbi, wallet);
    
    // Проверяем approve USDT
    const usdtContract = new ethers.Contract(
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT на Polygon
      ['function allowance(address, address) view returns (uint256)'],
      provider
    );
    
    const allowance = await usdtContract.allowance(buyerAddress, tokenAddress);
    if (allowance < ethers.parseUnits(usdtAmount, 6)) {
      return res.status(400).json({ error: "Недостаточно разрешений для USDT" });
    }
    
    const tx = await contract.buyAXFLO(ethers.parseUnits(usdtAmount, 6));
    await tx.wait();
    
    res.json({ 
      success: true, 
      txHash: tx.hash,
      axfloAmount: (ethers.parseUnits(usdtAmount, 6) * ethers.parseEther("1")) / await contract.getCurrentPrice()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;