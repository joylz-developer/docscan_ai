import os from 'os';
export function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        // Ignore virtual WSL, Hyper-V, Docker adapters
        const lower = name.toLowerCase();
        if (lower.includes('wsl') || lower.includes('vethernet') || lower.includes('docker') || lower.includes('virtual')) {
            continue;
        }
        const netList = interfaces[name];
        if (!netList)
            continue;
        for (const net of netList) {
            // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push(net.address);
            }
        }
    }
    // Fallback to all non-internal if list is empty
    if (addresses.length === 0) {
        for (const name of Object.keys(interfaces)) {
            const netList = interfaces[name];
            if (!netList)
                continue;
            for (const net of netList) {
                if (net.family === 'IPv4' && !net.internal) {
                    addresses.push(net.address);
                }
            }
        }
    }
    return addresses;
}
export function getPrimaryLocalIp() {
    const addresses = getLocalIpAddresses();
    // Strictly prefer standard Wi-Fi / Ethernet local subnet (192.168.x.x) first, then 10.x.x.x
    const wifiOrLan = addresses.find(ip => ip.startsWith('192.168.'));
    if (wifiOrLan)
        return wifiOrLan;
    const tenSubnet = addresses.find(ip => ip.startsWith('10.'));
    if (tenSubnet)
        return tenSubnet;
    const nonVirtual = addresses.find(ip => !ip.startsWith('172.17.') && !ip.startsWith('172.18.') && !ip.startsWith('172.19.'));
    return nonVirtual || addresses[0] || 'localhost';
}
