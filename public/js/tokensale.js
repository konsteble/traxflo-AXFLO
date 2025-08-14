// Конфигурация контрактов
const CONFIG = {
  sepolia: {
    tokenAddress: "0xB34D269F3303E1BF372fBe5B0c391376D8cd945c",
    saleAddress: "0xeF538Ed8D64993688a56247591C8f0c0DC4e50AE",
    chainId: "0xaa36a7", // Sepolia
    tokenDecimals: 18,
    saleGoal: 5_000_000 * 10**18 // Цель в wei
  }
};

// Глобальные переменные
let currentAccount = null;
let tokenContract, saleContract;
let currentPrice = 0.002;
let balanceUpdateInterval;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initBuyForm();
    initEventListeners();
    await checkWalletOnLoad();
    
    if (currentAccount) {
      await initContracts();
      await updateSaleInfo();
      await updateUserBalance();
    }
  } catch (error) {
    console.error("Init error:", error);
    showStatus('error', 'Ошибка инициализации');
  }
});

function initBuyForm() {
  const buyAmountInput = document.getElementById('buy-amount');
  const ethAmountInput = document.getElementById('eth-amount');
  
  buyAmountInput.addEventListener('input', () => {
    const amount = parseFloat(buyAmountInput.value) || 0;
    ethAmountInput.value = (amount * currentPrice).toFixed(8);
  });
  
  // Установить начальное значение
  ethAmountInput.value = (1000 * currentPrice).toFixed(8);
}

async function checkWalletOnLoad() {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        currentAccount = accounts[0];
        updateWalletUI(currentAccount);
      }
    } catch (error) {
      console.error("Wallet check error:", error);
    }
  }
}

async function initContracts() {
  try {
    if (!window.ethereum) throw new Error('MetaMask не установлен');
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Минимальный ABI для взаимодействия
    const tokenAbi = [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)"
    ];

    const saleAbi = [
      "function buyTokens() payable",
      "function getSaleInfo() view returns (uint256, uint256, uint256, bool)",
      "function price() view returns (uint256)",
      "function totalSold() view returns (uint256)"
    ];

    tokenContract = new ethers.Contract(CONFIG.sepolia.tokenAddress, tokenAbi, signer);
    saleContract = new ethers.Contract(CONFIG.sepolia.saleAddress, saleAbi, signer);

    document.getElementById('buy-button').disabled = false;
    
    // Запускаем периодическое обновление баланса
    balanceUpdateInterval = setInterval(updateUserBalance, 10000);
    
  } catch (error) {
    console.error("Contract init error:", error);
    throw error;
  }
}

async function updateSaleInfo() {
  try {
    const [totalSold, price] = await Promise.all([
      saleContract.totalSold(),
      saleContract.price()
    ]);
    
    currentPrice = Number(ethers.formatUnits(price, 18));
    const available = 5_000_000 - Number(ethers.formatUnits(totalSold, 18));
    const soldFormatted = Number(ethers.formatUnits(totalSold, 18));
    
    document.getElementById('sold-tokens').textContent = soldFormatted.toLocaleString();
    document.getElementById('available-tokens').textContent = available.toLocaleString();
    document.getElementById('current-price').textContent = currentPrice;
    document.getElementById('tokens-per-eth').textContent = (1 / currentPrice).toFixed(0);
    
    const progressPercent = (soldFormatted / 5_000_000) * 100;
    document.getElementById('sale-progress').style.width = `${progressPercent}%`;
    document.getElementById('progress-percent').textContent = `${progressPercent.toFixed(2)}%`;
    
  } catch (error) {
    console.error("Update error:", error);
    showStatus('error', 'Ошибка обновления данных');
  }
}

async function updateUserBalance() {
  try {
    if (!tokenContract || !currentAccount) {
      document.getElementById('user-balance-card').style.display = 'none';
      return;
    }
    
    const balance = await tokenContract.balanceOf(currentAccount);
    const balanceFormatted = ethers.formatUnits(balance, CONFIG.sepolia.tokenDecimals);
    
    document.getElementById('user-balance').textContent = parseFloat(balanceFormatted).toLocaleString();
    document.getElementById('user-balance-card').style.display = 'flex';
  } catch (error) {
    console.error("Balance update error:", error);
    document.getElementById('user-balance-card').style.display = 'none';
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error('Установите MetaMask');
    
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAccount = accounts[0];
    updateWalletUI(currentAccount);
    
    await initContracts();
    await updateSaleInfo();
    await updateUserBalance();
    
    document.getElementById('buy-button').disabled = false;
    
  } catch (error) {
    console.error("Connection error:", error);
    showStatus('error', `Ошибка подключения: ${error.message}`);
  }
}

function disconnectWallet() {
  currentAccount = null;
  const connectBtn = document.getElementById('connect-wallet');
  connectBtn.classList.remove('connected');
  connectBtn.innerHTML = 'Подключить MetaMask <span class="disconnect-btn" title="Отключить"><i class="fas fa-times"></i></span>';
  
  document.getElementById('buy-button').disabled = true;
  document.getElementById('user-balance-card').style.display = 'none';
  
  // Останавливаем обновление баланса
  if (balanceUpdateInterval) {
    clearInterval(balanceUpdateInterval);
  }
}

function updateWalletUI(address) {
  const connectBtn = document.getElementById('connect-wallet');
  const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  
  connectBtn.classList.add('connected');
  connectBtn.innerHTML = `${shortAddress} <span class="disconnect-btn" title="Отключить"><i class="fas fa-times"></i></span>`;
}

async function buyTokens() {
  try {
    const amount = document.getElementById('buy-amount').value;
    const ethAmount = ethers.parseEther((amount * currentPrice).toString());
    
    showStatus('pending', 'Подтвердите транзакцию в MetaMask...');
    
    const tx = await saleContract.buyTokens({
      value: ethAmount,
      gasLimit: 300000
    });
    
    await tx.wait();
    showStatus('success', 'Токены успешно куплены!');
    await updateSaleInfo();
    await updateUserBalance();
    
  } catch (error) {
    console.error("Buy error:", error);
    showStatus('error', `Ошибка: ${error.reason || error.message}`);
  }
}

function showStatus(type, message) {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  
  if (type !== 'pending') {
    setTimeout(() => {
      statusElement.className = 'status-message';
      statusElement.textContent = '';
    }, 5000);
  }
}

function initEventListeners() {
  document.getElementById('connect-wallet').addEventListener('click', connectWallet);
  document.querySelector('.disconnect-btn').addEventListener('click', disconnectWallet);
  document.getElementById('buy-button').addEventListener('click', buyTokens);
  
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        currentAccount = accounts[0];
        updateWalletUI(currentAccount);
        updateUserBalance();
      }
    });
    
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
}