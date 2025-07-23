// Конфигурация контрактов
const CONFIG = {
  sepolia: {
    tokenAddress: "0x7a081AC6Da625098F716047F8CCc2DBD7156c95d",
    saleAddress: "0xdBdEaeEFCEf60E329FA0c81F18BF758330b6A850",
    chainId: 11155111,
    tokenAbiPath: "/contracts/AXFLOToken.json",
    saleAbiPath: "/contracts/TokenSale.json"
  }
};

// Глобальные переменные
let currentAccount = null;
let provider, signer, tokenContract, saleContract;
let currentPrice = 0.002;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initTabs();
    initBuyForm();
    initEventListeners();
    await checkWalletOnLoad();
    await initContracts();
    await updateSaleInfo();
  } catch (error) {
    console.error("Init error:", error);
    showStatus('error', 'Ошибка инициализации');
  }
});

function initTabs() {
  const networkTabs = document.querySelectorAll('.network-tab');
  networkTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      networkTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const network = tab.dataset.network;
      document.querySelectorAll('.network-info').forEach(info => {
        info.classList.remove('active');
      });
      document.getElementById(`${network}-info`).classList.add('active');
    });
  });
}

function initBuyForm() {
  const buyAmountInput = document.getElementById('buy-amount');
  const ethAmountInput = document.getElementById('eth-amount');
  
  buyAmountInput.addEventListener('input', () => {
    const amount = parseFloat(buyAmountInput.value) || 0;
    ethAmountInput.value = (amount * currentPrice).toFixed(6);
  });
  
  ethAmountInput.value = (1000 * currentPrice).toFixed(6);
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
    
    // Используем RPC URL из .env (через переменную процесса)
    const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY";
    
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    
    const [tokenAbi, saleAbi] = await Promise.all([
      fetch(CONFIG.sepolia.tokenAbiPath).then(res => res.json()),
      fetch(CONFIG.sepolia.saleAbiPath).then(res => res.json())
    ]);
    
    tokenContract = new ethers.Contract(
      CONFIG.sepolia.tokenAddress,
      tokenAbi.abi,
      signer
    );
    
    saleContract = new ethers.Contract(
      CONFIG.sepolia.saleAddress,
      saleAbi.abi,
      signer
    );
    
  } catch (error) {
    console.error("Contract init error:", error);
    throw error;
  }
}

async function updateSaleInfo() {
  try {
    const [totalSold, price] = await Promise.all([
      saleContract.totalSold(),
      saleContract.currentPrice()
    ]);
    
    currentPrice = Number(ethers.formatUnits(price, 18));
    const available = 5_000_000 - Number(ethers.formatUnits(totalSold, 18));
    const soldFormatted = Number(ethers.formatUnits(totalSold, 18));
    
    document.getElementById('sold-tokens').textContent = soldFormatted.toLocaleString();
    document.getElementById('available-tokens').textContent = available.toLocaleString();
    document.getElementById('current-price').textContent = currentPrice;
    
    // Исправленная строка с прогресс-баром
    const progressPercent = (soldFormatted / 5_000_000) * 100;
    document.getElementById('sale-progress').style.width = `${progressPercent}%`;
    
  } catch (error) {
    console.error("Update error:", error);
    showStatus('error', 'Ошибка обновления данных');
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
    
    document.getElementById('approve-button').disabled = false;
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
  
  document.getElementById('approve-button').disabled = true;
  document.getElementById('buy-button').disabled = true;
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
    
    const tx = await saleContract.buyTokens(amount, {
      value: ethAmount
    });
    
    await tx.wait();
    showStatus('success', 'Токены успешно куплены!');
    await updateSaleInfo();
    addTransaction(tx.hash, amount, ethAmount);
    
  } catch (error) {
    console.error("Buy error:", error);
    showStatus('error', `Ошибка: ${error.message}`);
  }
}

function addTransaction(txHash, amount, ethAmount) {
  const tbody = document.getElementById('transactions-list');
  
  if (tbody.querySelector('td[colspan="5"]')) {
    tbody.innerHTML = '';
  }
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>Sepolia</td>
    <td>${amount} AXFLO</td>
    <td>${ethers.formatEther(ethAmount)} ETH</td>
    <td>${new Date().toLocaleString()}</td>
    <td><span class="status-badge status-success">Успешно</span></td>
  `;
  
  tbody.prepend(row);
}

function showStatus(type, message) {
  const statusElement = document.getElementById('sepolia-status');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  
  setTimeout(() => {
    if (statusElement.textContent === message) {
      statusElement.className = 'status-message';
    }
  }, 5000);
}

function initEventListeners() {
  document.getElementById('connect-wallet').addEventListener('click', connectWallet);
  document.querySelector('.disconnect-btn').addEventListener('click', disconnectWallet);
  document.getElementById('buy-button').addEventListener('click', buyTokens);
  document.getElementById('approve-button').addEventListener('click', approveTokens);
  
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        currentAccount = accounts[0];
        updateWalletUI(currentAccount);
      }
    });
  }
}

async function approveTokens() {
  try {
    showStatus('pending', 'Подтвердите Approve в MetaMask...');
    // Здесь будет логика approve
    await new Promise(resolve => setTimeout(resolve, 2000));
    showStatus('success', 'Approve успешно выполнен!');
  } catch (error) {
    showStatus('error', `Ошибка Approve: ${error.message}`);
  }
}