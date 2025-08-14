import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import TokenSaleABI from '../contracts/TokenSale.json';
import AXFLOTokenABI from '../contracts/AXFLOToken.json';
import BuyForm from '../components/TokenSale/BuyForm';
import ProgressBar from '../components/TokenSale/ProgressBar';
import styles from '../styles/TokenSale.module.css';

const CONTRACT_ADDRESSES = {
  sepolia: {
    token: "0xB34D269F3303E1BF372fBe5B0c391376D8cd945c",
    sale: "0xeF538Ed8D64993688a56247591C8f0c0DC4e50AE"
  }
};

export default function TokenSalePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [saleData, setSaleData] = useState({
    totalSold: 0,
    targetAmount: 5000000,
    price: 0.002
  });
  const [userBalance, setUserBalance] = useState(0);

  // Подключение MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setIsConnected(true);
        setAccount(accounts[0]);
        loadSaleData();
        loadUserBalance();
        
        // Обработчик изменения аккаунтов
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length === 0) {
            setIsConnected(false);
            setAccount(null);
            setUserBalance(0);
          } else {
            setAccount(accounts[0]);
            loadUserBalance();
          }
        });
      } catch (error) {
        console.error('Connection error:', error);
      }
    }
  };

  // Загрузка данных о токенсейле
  const loadSaleData = async () => {
    if (!window.ethereum) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const saleContract = new ethers.Contract(
        CONTRACT_ADDRESSES.sepolia.sale,
        TokenSaleABI.abi,
        provider
      );

      const [totalSold, price] = await Promise.all([
        saleContract.totalSold(),
        saleContract.price()
      ]);

      setSaleData(prev => ({
        ...prev,
        totalSold: parseFloat(ethers.formatUnits(totalSold, 18)),
        price: parseFloat(ethers.formatUnits(price, 18))
      }));
    } catch (error) {
      console.error('Error loading sale data:', error);
    }
  };

  // Загрузка баланса пользователя
  const loadUserBalance = async () => {
    if (!window.ethereum || !account) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tokenContract = new ethers.Contract(
        CONTRACT_ADDRESSES.sepolia.token,
        AXFLOTokenABI.abi,
        provider
      );

      const balance = await tokenContract.balanceOf(account);
      setUserBalance(parseFloat(ethers.formatUnits(balance, 18)));
    } catch (error) {
      console.error('Error loading user balance:', error);
    }
  };

  return (
    <div className={styles.container}>
      <h1>AXFLO Token Sale</h1>
      
      {!isConnected ? (
        <button onClick={connectWallet} className={styles.connectButton}>
          Connect MetaMask
        </button>
      ) : (
        <div className={styles.walletInfo}>
          <span>Connected: {`${account.substring(0, 6)}...${account.substring(38)}`}</span>
          {userBalance > 0 && (
            <div className={styles.balanceInfo}>
              Your AXFLO Balance: <span className={styles.balanceAmount}>{userBalance.toLocaleString()}</span>
            </div>
          )}
          <ProgressBar 
            totalSold={saleData.totalSold} 
            targetAmount={saleData.targetAmount} 
          />
          <BuyForm 
            tokenPrice={saleData.price} 
            saleAddress={CONTRACT_ADDRESSES.sepolia.sale}
            tokenAddress={CONTRACT_ADDRESSES.sepolia.token}
          />
        </div>
      )}
    </div>
  );
}