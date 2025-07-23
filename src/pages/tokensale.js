import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import TokenSaleABI from '../contracts/TokenSale.json';
import AXFLOTokenABI from '../contracts/AXFLOToken.json';
import BuyForm from '../components/TokenSale/BuyForm';
import ProgressBar from '../components/TokenSale/ProgressBar';
import styles from '../styles/TokenSale.module.css';

export default function TokenSalePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [contracts, setContracts] = useState(null);
  const [saleData, setSaleData] = useState({
    totalSold: 0,
    targetAmount: 0,
    price: 0
  });

  // Загрузка адресов контрактов
  useEffect(() => {
    fetch('/contracts.json')
      .then(res => res.json())
      .then(data => setContracts(data))
      .catch(console.error);
  }, []);

  // Подключение MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        setIsConnected(true);
        loadSaleData();
      } catch (error) {
        console.error('Connection error:', error);
      }
    }
  };

  // Загрузка данных о токенсейле
  const loadSaleData = async () => {
    if (!contracts) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const saleContract = new ethers.Contract(
      contracts.sale,
      TokenSaleABI.abi,
      provider
    );

    const [totalSold, targetAmount, price] = await Promise.all([
      saleContract.totalSold(),
      saleContract.targetAmount(),
      saleContract.tokenPrice()
    ]);

    setSaleData({
      totalSold: parseFloat(ethers.formatEther(totalSold)),
      targetAmount: parseFloat(ethers.formatEther(targetAmount)),
      price: parseFloat(ethers.formatEther(price))
    });
  };

  return (
    <div className={styles.container}>
      <h1>AXFLO Token Sale</h1>
      
      {!isConnected ? (
        <button onClick={connectWallet} className={styles.connectButton}>
          Connect MetaMask
        </button>
      ) : (
        <>
          <ProgressBar 
            totalSold={saleData.totalSold} 
            targetAmount={saleData.targetAmount} 
          />
          <BuyForm 
            tokenPrice={saleData.price} 
            saleContract={contracts?.sale} 
          />
        </>
      )}
    </div>
  );
}