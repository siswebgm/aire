/**
 * SCANNER DE REDE PARA DESCOBERTA AUTOMÁTICA DE ESP32s
 * Execute este script no Node.js para encontrar todos os ESP32s na rede
 */

const dgram = require('dgram');
const http = require('http');
const { exec } = require('child_process');

class ESP32Scanner {
    constructor() {
        this.devices = new Map();
        this.udpClient = dgram.createSocket('udp4');
        this.setupUDPListener();
    }

    setupUDPListener() {
        this.udpClient.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'ping' && data.device && data.device.startsWith('AIRE-ESP32-')) {
                    console.log(`📡 Ping recebido: ${data.device} (${data.ip})`);
                    this.devices.set(data.id, {
                        ...data,
                        lastSeen: Date.now(),
                        source: 'udp'
                    });
                }
            } catch (error) {
                // Ignora mensagens inválidas
            }
        });

        this.udpClient.on('error', (err) => {
            console.error('UDP Error:', err);
        });

        this.udpClient.bind(8888, () => {
            console.log('📡 Escutando pings UDP na porta 8888...');
        });
    }

    async scanNetwork(networkPrefix = '192.168.1') {
        console.log(`🔍 Escaneando rede ${networkPrefix}.x...`);
        
        const promises = [];
        
        // Escaneia range de IPs comuns
        for (let i = 1; i <= 254; i++) {
            const ip = `${networkPrefix}.${i}`;
            promises.push(this.checkDevice(ip));
        }
        
        await Promise.all(promises);
        
        // Aguarda pings UDP
        await this.sleep(5000);
        
        return this.devices;
    }

    async checkDevice(ip) {
        return new Promise((resolve) => {
            const timeout = 3000;
            
            const req = http.get(`http://${ip}/discovery`, { timeout }, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const device = JSON.parse(data);
                        if (device.device && device.device.startsWith('AIRE-ESP32-')) {
                            console.log(`✅ ESP32 encontrado: ${device.device} (${ip})`);
                            this.devices.set(device.id, {
                                ...device,
                                ip: ip,
                                lastSeen: Date.now(),
                                source: 'http'
                            });
                        }
                    } catch (error) {
                        // Ignora erros de parsing
                    }
                    resolve();
                });
            });
            
            req.on('error', () => {
                resolve(); // Silenciosamente ignora falhas
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve();
            });
        });
    }

    async pingDevices() {
        console.log('📡 Enviando ping broadcast...');
        
        const message = JSON.stringify({
            type: 'discovery_request',
            timestamp: Date.now()
        });
        
        this.udpClient.send(message, 8888, '255.255.255.255', (err) => {
            if (err) console.error('Erro ao enviar ping:', err);
        });
    }

    async getARPTable() {
        return new Promise((resolve) => {
            exec('arp -a', (error, stdout) => {
                if (error) {
                    resolve([]);
                    return;
                }
                
                const devices = [];
                const lines = stdout.split('\n');
                
                for (const line of lines) {
                    const match = line.match(/\(([\d.]+)\)/);
                    if (match) {
                        devices.push(match[1]);
                    }
                }
                
                resolve(devices);
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatResults() {
        console.log('\n📊 RESULTADO DA BUSCA:');
        console.log('='.repeat(50));
        
        if (this.devices.size === 0) {
            console.log('❌ Nenhum ESP32 encontrado');
            return;
        }
        
        this.devices.forEach((device, id) => {
            console.log(`\n🎯 DISPOSITIVO ENCONTRADO:`);
            console.log(`   Nome: ${device.device}`);
            console.log(`   ID: ${device.id}`);
            console.log(`   IP: ${device.ip}`);
            console.log(`   Hostname: ${device.hostname || 'N/A'}`);
            console.log(`   Status: ${device.status}`);
            console.log(`   Fonte: ${device.source}`);
            console.log(`   Uptime: ${device.uptime || 'N/A'}s`);
            console.log(`   Memória: ${device.memoria_livre || 'N/A'} bytes`);
            console.log(`   RSSI: ${device.rssi || 'N/A'} dBm`);
            console.log(`   Último visto: ${new Date(device.lastSeen).toLocaleString()}`);
            console.log(`   Acessar: http://${device.ip}/discovery`);
        });
        
        console.log(`\n📈 Total: ${this.devices.size} ESP32(s) encontrado(s)`);
        
        // Gera configuração para o sistema
        console.log('\n⚙️  CONFIGURAÇÃO PARA O SISTEMA:');
        console.log('Copie e cole no seu sistema:');
        console.log('');
        
        const ips = Array.from(this.devices.values()).map(d => d.ip);
        console.log(`const ESP32_IPS = [${ips.map(ip => `"${ip}"`).join(', ')}];`);
    }
}

async function main() {
    console.log('🚀 INICIANDO SCANNER DE ESP32s AIRE');
    console.log('='.repeat(50));
    
    const scanner = new ESP32Scanner();
    
    try {
        // Envia ping broadcast
        await scanner.pingDevices();
        
        // Escaneia rede local
        await scanner.scanNetwork();
        
        // Formata resultados
        scanner.formatResults();
        
        // Mantém listener ativo por mais tempo para capturar pings
        console.log('\n⏳ Aguardando mais pings por 10 segundos...');
        await scanner.sleep(10000);
        
        // Resultado final
        scanner.formatResults();
        
    } catch (error) {
        console.error('❌ Erro no scanner:', error);
    } finally {
        process.exit(0);
    }
}

// Executa se chamado diretamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ESP32Scanner;
