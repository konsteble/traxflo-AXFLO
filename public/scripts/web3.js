// Проверяем загрузку DOM перед выполнением кода
document.addEventListener('DOMContentLoaded', function() {
  // Ждем 500 мс для полной инициализации MetaMask
  setTimeout(initWeb3, 500);
});

async function initWeb3() {
  const connectButton = document.getElementById('wallet-connect');
  
  if (!connectButton) {
    console.warn('Кнопка подключения кошелька не найдена');
    return;
  }

  // Проверяем наличие MetaMask
  if (typeof window.ethereum === 'undefined') {
    connectButton.textContent = 'Установите MetaMask';
    connectButton.style.backgroundColor = '#e74c3c';
    connectButton.onclick = () => {
      window.open('https://metamask.io/download.html', '_blank');
    };
    return;
  }

  // Обработчик подключения
  connectButton.addEventListener('click', async () => {
    try {
      connectButton.disabled = true;
      connectButton.textContent = 'Подключение...';
      
      // Запрашиваем доступ к аккаунтам
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Обновляем UI после успешного подключения
      updateWalletButton(connectButton, accounts[0]);
      
      // Можно добавить дополнительную логику:
      // - Проверку сети (chainId)
      // - Получение баланса
      // - Инициализацию контрактов
      
    } catch (error) {
      console.error('Ошибка подключения:', error);
      connectButton.textContent = 'Ошибка подключения';
      connectButton.style.backgroundColor = '#e74c3c';
      setTimeout(() => {
        connectButton.textContent = 'Подключить MetaMask';
        connectButton.style.backgroundColor = '#f39c12';
        connectButton.disabled = false;
      }, 2000);
    }
  });

  // Проверяем уже подключенные аккаунты
  checkConnectedAccounts(connectButton);
}

// Обновление кнопки кошелька
function updateWalletButton(button, address) {
  button.textContent = `✔ ${address.slice(0,6)}...${address.slice(-4)}`;
  button.style.backgroundColor = '#2ecc71';
  button.disabled = false;
  
  // Сохраняем адрес в localStorage
  localStorage.setItem('connectedWallet', address);
}

// Проверка уже подключенных аккаунтов
async function checkConnectedAccounts(button) {
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      updateWalletButton(button, accounts[0]);
    }
  } catch (error) {
    console.error('Ошибка проверки аккаунтов:', error);
  }
}

// Обработчик изменения аккаунтов
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    const button = document.getElementById('wallet-connect');
    if (accounts.length === 0) {
      button.textContent = 'Подключить MetaMask';
      button.style.backgroundColor = '#f39c12';
      localStorage.removeItem('connectedWallet');
    } else if (button) {
      updateWalletButton(button, accounts[0]);
    }
  });
}