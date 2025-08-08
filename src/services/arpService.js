const { exec } = require('child_process');
const util = require('util');
const ping = require('ping');
const execAsync = util.promisify(exec);

/**
 * İşletim sistemine uygun komutu çalıştırarak ARP tablosunu okur.
 * @returns {Promise<Array<Object>>} ARP girdilerini içeren bir dizi döner.
 */
async function readArpTable() {
  const platform = process.platform;
  let commandOutput;

  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync('arp -a');
      commandOutput = stdout;
      return parseArpAOutputForWindows(commandOutput);
    } else if (platform === 'linux') {
      // Modern Linux sistemleri için 'ip neigh' daha detaylıdır.
      const { stdout } = await execAsync('ip -4 neigh show');
      commandOutput = stdout;
      return parseIpNeigh(commandOutput);
    } else if (platform === 'darwin') { // macOS
      const { stdout } = await execAsync('arp -a');
      commandOutput = stdout;
      return parseArpAOutputForMac(commandOutput);
    } else {
      throw new Error(`Desteklenmeyen işletim sistemi: ${platform}`);
    }
  } catch (error) {
    // 'ip neigh' başarısız olursa veya eski bir Linux'ta 'arp -a' deneyebiliriz.
    if (platform === 'linux' && error.stderr.includes('command not found')) {
      const { stdout } = await execAsync('arp -a');
      return parseArpAOutputForMac(stdout); // Linux arp -a çıktısı macOS'a benzer
    }
    throw error;
  }
}

/**
 * Windows 'arp -a' komutunun çıktısını parse eder.
 * Örnek:
 *   Interface: 192.168.1.10 --- 0x11
 *     Internet Address      Physical Address      Type
 *     192.168.1.1           a1-b2-c3-d4-e5-f6     dynamic
 *     192.168.1.255         ff-ff-ff-ff-ff-ff     static
 */
function parseArpAOutputForWindows(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const entries = [];
  for (const line of lines) {
    if (line.toLowerCase().includes('interface') || line.toLowerCase().includes('internet address')) {
      continue; // Başlık satırlarını atla
    }
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const ip = parts[0];
      const mac = parts[1].toUpperCase().replace(/-/g, ':');
      const type = parts[2];
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) { // Geçerli bir IP adresi mi?
         entries.push({ ip, mac, type, raw: line });
      }
    }
  }
  return entries;
}

/**
 * macOS ve Linux 'arp -a' çıktısını parse eder.
 * Örnek (macOS): ? (192.168.1.1) at a1:b2:c3:d4:e5:f6 on en0 ifscope [ethernet]
 */
function parseArpAOutputForMac(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const entries = [];
    for (const line of lines) {
        const match = line.match(/\((\d+\.\d+\.\d+\.\d+)\) at ([0-9a-f:]+)/i);
        if (match) {
            entries.push({ ip: match[1], mac: match[2].toUpperCase(), type: 'dynamic', raw: line });
        }
    }
    return entries;
}


/**
 * Linux 'ip neigh' komutunun çıktısını parse eder.
 * Örnek: 192.168.1.1 dev eth0 lladdr a1:b2:c3:d4:e5:f6 REACHABLE
 */
function parseIpNeigh(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const entries = [];
  for (const line of lines) {
    const parts = line.split(' ');
    if (parts.length >= 5 && parts.includes('lladdr')) {
      const ip = parts[0];
      const mac = parts[parts.indexOf('lladdr') + 1].toUpperCase();
      const type = parts[parts.length - 1]; // STALE, REACHABLE etc.
      entries.push({ ip, mac, type, raw: line });
    }
  }
  return entries;
}

/**
 * Belirtilen IP aralığını paralel olarak pingler ve canlı cihazları bulur.
 * @param {string} networkBase - '192.168.1' gibi ağ adresi.
 * @param {number} start - Başlangıç IP okteti.
 * @param {number} end - Bitiş IP okteti.
 * @param {function} onProgress - Her bir IP tarandığında çağrılacak callback.
 * @returns {Promise<Array<Object>>} Canlı bulunan cihazların listesi.
 */
async function pingSweep(networkBase, start = 1, end = 254, onProgress = () => {}) {
  const promises = [];
  for (let i = start; i <= end; i++) {
    const ip = `${networkBase}.${i}`;
    const promise = ping.promise.probe(ip, { timeout: 1, extra: ['-c', '1'] })
      .then(res => {
        onProgress({ ip, status: res.alive ? 'Online' : 'Offline' });
        return res;
      });
    promises.push(promise);
  }

  // Tüm ping'lerin tamamlanmasını bekle
  const results = await Promise.all(promises);
  
  // Sadece canlı olanları filtrele
  return results.filter(res => res.alive).map(res => ({
    ip: res.host,
    alive: res.alive,
    time: res.time
  }));
}

module.exports = { readArpTable, pingSweep };