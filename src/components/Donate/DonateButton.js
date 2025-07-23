import { useEffect, useState } from 'react';
import { web3 } from '../scripts/web3';

const DonateButton = ({ track }) => {
  const [balance, setBalance] = useState({ TXF: 0, X: 0 });
  const [amount, setAmount] = useState(1);
  const [currency, setCurrency] = useState('TXF');

  useEffect(() => {
    const loadBalance = async () => {
      const txBalance = await web3.contracts.TXF.balanceOf(web3.account);
      const xBalance = await web3.contracts.X.balanceOf(web3.account);
      
      setBalance({
        TXF: web3.utils.fromWei(txBalance),
        X: web3.utils.fromWei(xBalance)
      });
    };
    
    if (web3.isConnected) loadBalance();
  }, []);

  const handleDonate = async () => {
    const success = await web3.sendDonation(
      track.artist_wallet, 
      amount, 
      currency
    );
    
    if (success) {
      // Обновляем баланс через API
      await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: track.id,
          amount,
          currency
        })
      });
    }
  };

  return (
    <div className="donate-widget">
      <select onChange={(e) => setCurrency(e.target.value)}>
        <option value="TXF">TXF (Balance: {balance.TXF})</option>
        <option value="X">X (Balance: {balance.X})</option>
      </select>
      
      <input
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      
      <button onClick={handleDonate}>
        Поддержать {currency === 'TXF' ? 'автора' : 'проект'}
      </button>
    </div>
  );
};

export default DonateButton;