// Proxy simples para ESP32 - contorna problema de CORS
// Execute com: node esp32-proxy.js

const http = require('http');

const ESP32_IP = '192.168.1.73';
const ESP32_TOKEN = 'teste';
const PROXY_PORT = 3333;

const server = http.createServer(async (req, res) => {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  console.log(`[PROXY] ${req.method} ${url}`);

  // Determinar endpoint do ESP32
  let esp32Endpoint = '';
  if (url.includes('/abrir')) {
    esp32Endpoint = '/abrir';
  } else if (url.includes('/fechar')) {
    esp32Endpoint = '/fechar';
  } else if (url.includes('/health') || url.includes('/status')) {
    esp32Endpoint = '/status';
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint não encontrado' }));
    return;
  }

  try {
    // Fazer requisição para o ESP32
    const esp32Url = `http://${ESP32_IP}${esp32Endpoint}`;
    console.log(`[PROXY] Encaminhando para: ${esp32Url}`);

    const response = await fetch(esp32Url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${ESP32_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    console.log(`[PROXY] Resposta ESP32: ${response.status} - ${text}`);

    res.writeHead(response.status, { 'Content-Type': 'application/json' });
    res.end(text || JSON.stringify({ ok: true }));
  } catch (err) {
    console.error(`[PROXY] Erro:`, err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PROXY_PORT, () => {
  console.log(`\n========================================`);
  console.log(`ESP32 Proxy Server`);
  console.log(`========================================`);
  console.log(`Proxy rodando em: http://localhost:${PROXY_PORT}`);
  console.log(`ESP32 IP: ${ESP32_IP}`);
  console.log(`\nEndpoints disponíveis:`);
  console.log(`  POST http://localhost:${PROXY_PORT}/abrir`);
  console.log(`  POST http://localhost:${PROXY_PORT}/fechar`);
  console.log(`  GET  http://localhost:${PROXY_PORT}/status`);
  console.log(`========================================\n`);
});
