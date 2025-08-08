import React, { useEffect, useState, useCallback } from 'react';

// Varsayılan tarama ayarları
const DEFAULT_SCAN_CONFIG = {
  network: '192.168.1',
  rangeStart: 1,
  rangeEnd: 254
};

export default function App() {
  const [arpEntries, setArpEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [scanConfig, setScanConfig] = useState(DEFAULT_SCAN_CONFIG);

  // Log'a yeni bir mesaj ekleyen yardımcı fonksiyon
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [`[${timestamp}] - ${message}`, ...prev].slice(0, 100)); // Son 100 log'u tut
  }, []);

  // Durum mesajını ayarlayan ve bir süre sonra temizleyen fonksiyon
  const showStatus = (message, type = 'success', duration = 4000) => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: '' }), duration);
  };

  // ARP tablosunu yenileme fonksiyonu
  const refreshArpTable = async () => {
    setLoading(true);
    addLog('ARP tablosu yenileniyor...');
    const res = await window.electronAPI.readArp();
    if (res.ok) {
      setArpEntries(res.table);
      showStatus(`ARP tablosu başarıyla yenilendi. ${res.table.length} kayıt bulundu.`);
      addLog(`Başarılı: ${res.table.length} kayıt bulundu.`);
    } else {
      showStatus(`Hata: ${res.error}`, 'error');
      addLog(`HATA: ${res.error}`, 'error');
    }
    setLoading(false);
  };

  // Ping taramasını başlatan fonksiyon
  const handlePingSweep = async () => {
    setScanning(true);
    setLog([]); // Taramaya başlarken log'u temizle
    addLog(`Ağ taraması başlatıldı: ${scanConfig.network}.${scanConfig.rangeStart}-${scanConfig.rangeEnd}`);
    const res = await window.electronAPI.pingSweep(scanConfig);
    if (res.ok) {
      addLog(`Tarama tamamlandı. ${res.results.length} aktif cihaz bulundu.`);
      addLog('En güncel sonuçlar için ARP tablosunu şimdi yenileyin.');
      showStatus('Ağ taraması tamamlandı. ARP tablosunu yenileyin.', 'success');
    } else {
      addLog(`Tarama hatası: ${res.error}`, 'error');
      showStatus(`Tarama hatası: ${res.error}`, 'error');
    }
    setScanning(false);
    await refreshArpTable(); // Tarama bitince ARP tablosunu otomatik yenile
  };
  
  // CSV Dışa Aktarma
  const handleExport = async () => {
    if (arpEntries.length === 0) return showStatus('Dışa aktarılacak veri yok.', 'error');
    addLog('CSV dışa aktarma işlemi başlatıldı.');
    const res = await window.electronAPI.exportCsv(arpEntries);
    if (res.ok) {
      showStatus(`Başarıyla dışa aktarıldı: ${res.path}`, 'success');
      addLog(`CSV dosyası kaydedildi: ${res.path}`);
    } else {
      showStatus(`Dışa aktarma başarısız: ${res.error}`, 'error');
      addLog(`CSV Aktarma Hatası: ${res.error}`, 'error');
    }
  }

  // Component yüklendiğinde ARP tablosunu ve progress listener'ı ayarla
  useEffect(() => {
    refreshArpTable();

    const removeListener = window.electronAPI.onPingSweepProgress((progress) => {
      // Canlı tarama log'u
      addLog(`Taranıyor: ${progress.ip} - ${progress.status}`, 'info');
    });

    // Component kaldırıldığında listener'ı temizle
    return () => removeListener();
  }, [addLog]);

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setScanConfig(prev => ({ ...prev, [name]: value }));
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Gelişmiş ARP & Ağ Tarayıcı</h1>
        <p>
          ARP (Adres Çözümleme Protokolü), yerel ağınızdaki bir IP adresini bir MAC (Fiziksel) adresine çevirir. Bu araç, sisteminizin ARP önbelleğini görüntülemenize ve ağı tarayarak yeni cihazlar keşfetmenize olanak tanır.
        </p>
      </header>
      
      <div className="controls">
        <button onClick={refreshArpTable} disabled={loading || scanning}>
          {loading ? 'Yenileniyor...' : 'ARP Tablosunu Yenile'}
        </button>
        <button onClick={handleExport} disabled={loading || scanning || arpEntries.length === 0}>
          CSV Olarak Dışa Aktar
        </button>
        <div style={{marginLeft: 'auto', display:'flex', gap:'8px', alignItems:'center'}}>
          <span>IP Aralığı:</span>
          <input type="text" name="network" value={scanConfig.network} onChange={handleConfigChange} disabled={scanning} />
          .
          <input type="number" name="rangeStart" value={scanConfig.rangeStart} onChange={handleConfigChange} disabled={scanning} style={{width:60}} min="1" max="254"/>
          -
          <input type="number" name="rangeEnd" value={scanConfig.rangeEnd} onChange={handleConfigChange} disabled={scanning} style={{width:60}} min="1" max="254"/>
          <button onClick={handlePingSweep} disabled={loading || scanning}>
            {scanning ? 'Taranıyor...' : 'Ağı Tara (Ping Sweep)'}
          </button>
        </div>
      </div>

      {status.message && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}

      <div className="main-content">
        <div className="table-container">
          <h3>ARP Tablosu ({arpEntries.length} Kayıt)</h3>
          <div style={{height: 500, overflow:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th>IP Adresi</th>
                  <th>MAC Adresi</th>
                  <th>Türü</th>
                </tr>
              </thead>
              <tbody>
                {arpEntries.map((e, i) => (
                  <tr key={i}>
                    <td>{e.ip}</td>
                    <td>{e.mac}</td>
                    <td>{e.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="status-container">
          <h3>Canlı Günlük / Durum</h3>
          <div className="log-box">
            {log.length > 0 ? log.map((msg, i) => {
              const type = msg.includes('HATA') ? 'error' : msg.includes('Başarılı') ? 'success' : 'info';
              return <div key={i} className={type}>{msg}</div>
            }) : 'Henüz bir log mesajı yok.'}
          </div>
        </div>
      </div>
    </div>
  );
}