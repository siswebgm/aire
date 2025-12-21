# Como Programar o ESP32 - Guia Completo

## 🛠️ Ferramentas Necessárias

### 1. Arduino IDE
- Download: https://www.arduino.cc/en/software
- Versão recomendada: 2.x ou superior

### 2. Drivers USB (se necessário)
- **CP2102**: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
- **CH340**: http://www.wch.cn/downloads/CH341SER_ZIP.html

---

## 📦 Instalação do Suporte ESP32 no Arduino IDE

### Passo 1: Adicionar URL do Gerenciador de Placas

1. Abra Arduino IDE
2. Vá em **File → Preferences** (ou `Ctrl + ,`)
3. Em **Additional Boards Manager URLs**, adicione:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Clique **OK**

### Passo 2: Instalar Placa ESP32

1. Vá em **Tools → Board → Boards Manager**
2. Busque por **"esp32"**
3. Instale **"esp32 by Espressif Systems"**
4. Aguarde a instalação (pode demorar alguns minutos)

### Passo 3: Selecionar a Placa

1. Vá em **Tools → Board → ESP32 Arduino**
2. Selecione sua placa (ex: **ESP32 Dev Module**)

---

## 📚 Bibliotecas Necessárias

Instale via **Sketch → Include Library → Manage Libraries**:

1. **WiFi** (já vem com ESP32)
2. **WebServer** (já vem com ESP32)

---

## 💻 Código Completo para o ESP32

Copie e cole este código no Arduino IDE:

```cpp
#include <WiFi.h>
#include <WebServer.h>

// ============================================
// CONFIGURAÇÕES - EDITE AQUI
// ============================================

// WiFi
const char* WIFI_SSID = "SUA_REDE_WIFI";        // Nome da sua rede WiFi
const char* WIFI_PASSWORD = "SUA_SENHA_WIFI";  // Senha da sua rede WiFi

// Token de autenticação (mesmo do .env)
const char* BEARER_TOKEN = "Bearer teste";

// Pinos
#define SENSOR_PIN 4   // Pino do sensor de porta fechada (GPIO4)
#define MOTOR_PIN 5    // Pino do motor/solenóide (GPIO5)

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

WebServer server(80);
bool comandoFechar = false;
unsigned long tempoInicioComando = 0;
const unsigned long TIMEOUT_FECHAR = 30000; // 30 segundos timeout

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

bool validarToken() {
  if (!server.hasHeader("Authorization")) {
    Serial.println("[AUTH] Header Authorization não encontrado");
    return false;
  }
  
  String authHeader = server.header("Authorization");
  bool valido = (authHeader == String(BEARER_TOKEN));
  
  if (!valido) {
    Serial.println("[AUTH] Token inválido: " + authHeader);
  }
  
  return valido;
}

void enviarResposta(int codigo, const char* tipo, const char* mensagem) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  server.send(codigo, tipo, mensagem);
}

// ============================================
// ENDPOINTS HTTP
// ============================================

void handleOptions() {
  Serial.println("[OPTIONS] Requisição CORS preflight");
  enviarResposta(200, "text/plain", "");
}

void handleHealth() {
  Serial.println("[GET] /health");
  
  char resposta[200];
  snprintf(resposta, sizeof(resposta), 
    "{\"status\":\"online\",\"device\":\"ESP32-GAVETEIRO\",\"uptime\":%lu,\"wifi\":\"%s\"}",
    millis() / 1000,
    WiFi.SSID().c_str()
  );
  
  enviarResposta(200, "application/json", resposta);
}

void handleAbrir() {
  Serial.println("[POST] /abrir");
  
  if (!validarToken()) {
    enviarResposta(401, "application/json", "{\"error\":\"Token inválido\"}");
    return;
  }
  
  // Desligar motor (libera trava)
  digitalWrite(MOTOR_PIN, LOW);
  Serial.println("[MOTOR] Porta ABERTA (trava liberada)");
  
  enviarResposta(200, "application/json", "{\"ok\":true,\"message\":\"Porta aberta\"}");
}

void handleFechar() {
  Serial.println("[POST] /fechar");
  
  if (!validarToken()) {
    enviarResposta(401, "application/json", "{\"error\":\"Token inválido\"}");
    return;
  }
  
  // Ativar comando de fechamento
  comandoFechar = true;
  tempoInicioComando = millis();
  
  Serial.println("[MOTOR] Comando de fechamento recebido");
  Serial.println("[SENSOR] Aguardando porta encostar...");
  
  enviarResposta(200, "application/json", "{\"ok\":true,\"message\":\"Comando de fechamento enviado\"}");
}

void handleNotFound() {
  Serial.println("[404] Rota não encontrada: " + server.uri());
  enviarResposta(404, "application/json", "{\"error\":\"Rota não encontrada\"}");
}

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("ESP32 - Sistema de Gaveteiros");
  Serial.println("========================================\n");
  
  // Configurar pinos
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW); // Iniciar com porta aberta
  
  Serial.println("[PINOS] Configurados:");
  Serial.println("  - Sensor: GPIO " + String(SENSOR_PIN));
  Serial.println("  - Motor:  GPIO " + String(MOTOR_PIN));
  
  // Conectar WiFi
  Serial.println("\n[WiFi] Conectando a: " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✓ Conectado!");
    Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
    Serial.println("[WiFi] Gateway: " + WiFi.gatewayIP().toString());
  } else {
    Serial.println("\n[WiFi] ✗ Falha ao conectar!");
    Serial.println("[WiFi] Reiniciando em 5 segundos...");
    delay(5000);
    ESP.restart();
  }
  
  // Configurar rotas HTTP
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/abrir", HTTP_POST, handleAbrir);
  server.on("/abrir", HTTP_OPTIONS, handleOptions);
  server.on("/fechar", HTTP_POST, handleFechar);
  server.on("/fechar", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);
  
  // Iniciar servidor
  server.begin();
  Serial.println("\n[HTTP] Servidor iniciado na porta 80");
  Serial.println("[HTTP] Endpoints disponíveis:");
  Serial.println("  - GET  /health");
  Serial.println("  - POST /abrir");
  Serial.println("  - POST /fechar");
  
  Serial.println("\n========================================");
  Serial.println("Sistema pronto! Aguardando requisições...");
  Serial.println("========================================\n");
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // Processar requisições HTTP
  server.handleClient();
  
  // Processar comando de fechamento
  if (comandoFechar) {
    // Verificar timeout
    if (millis() - tempoInicioComando > TIMEOUT_FECHAR) {
      Serial.println("[TIMEOUT] Porta não fechou em 30 segundos");
      comandoFechar = false;
      digitalWrite(MOTOR_PIN, LOW); // Desligar motor
      return;
    }
    
    // Acionar motor para fechar
    digitalWrite(MOTOR_PIN, HIGH);
    
    // Verificar sensor (LOW = porta fechada, HIGH = porta aberta)
    if (digitalRead(SENSOR_PIN) == LOW) {
      // Porta encostou!
      digitalWrite(MOTOR_PIN, HIGH); // Manter trava acionada
      comandoFechar = false;
      
      Serial.println("[SENSOR] ✓ Porta fechada detectada!");
      Serial.println("[MOTOR] Trava acionada");
      Serial.println("========================================\n");
    }
    
    delay(50); // Pequeno delay para não sobrecarregar
  }
}
```

---

## 🔌 Conexões Físicas

### Sensor de Porta (Magnético ou Reed Switch)

```
Sensor Reed Switch → ESP32
  - Pino 1 → GPIO 4 (SENSOR_PIN)
  - Pino 2 → GND
```

**Como funciona:**
- Porta aberta: Sensor = HIGH (3.3V)
- Porta fechada: Sensor = LOW (0V)

### Motor/Solenóide (com Relé)

```
Relé → ESP32
  - VCC → 3.3V
  - GND → GND
  - IN  → GPIO 5 (MOTOR_PIN)

Relé → Motor/Solenóide
  - COM → +12V (fonte externa)
  - NO  → Motor +
  - Motor - → GND (fonte externa)
```

**⚠️ IMPORTANTE:** Nunca conecte motor direto no ESP32! Use sempre um relé.

---

## 📝 Passo a Passo para Upload

### 1. Editar Configurações

No código, edite estas linhas:

```cpp
const char* WIFI_SSID = "SUA_REDE_WIFI";        // ← Seu WiFi
const char* WIFI_PASSWORD = "SUA_SENHA_WIFI";  // ← Sua senha
const char* BEARER_TOKEN = "Bearer teste";      // ← Mesmo do .env
```

### 2. Conectar ESP32 ao Computador

- Use cabo USB
- Verifique se drivers estão instalados
- Veja qual porta COM foi detectada (ex: COM3)

### 3. Configurar Arduino IDE

1. **Tools → Board** → ESP32 Dev Module
2. **Tools → Port** → Selecione a porta COM
3. **Tools → Upload Speed** → 115200
4. **Tools → Flash Frequency** → 80MHz

### 4. Fazer Upload

1. Clique no botão **Upload** (→)
2. Aguarde compilação
3. Quando aparecer "Connecting...", pressione o botão **BOOT** no ESP32
4. Aguarde upload completar

### 5. Abrir Monitor Serial

1. **Tools → Serial Monitor**
2. Configure para **115200 baud**
3. Você verá os logs do ESP32

---

## 🧪 Testando

### 1. Verificar IP no Monitor Serial

```
[WiFi] ✓ Conectado!
[WiFi] IP: 192.168.1.72  ← Anote este IP
```

### 2. Atualizar .env

No arquivo `.env` do projeto web, coloque o IP correto:

```env
VITE_ESP32_BASE_URL=http://192.168.1.72
```

### 3. Testar Endpoints

**Teste 1: Health Check**
```bash
curl http://192.168.1.72/health
```

Resposta esperada:
```json
{"status":"online","device":"ESP32-GAVETEIRO","uptime":123,"wifi":"MinhaRede"}
```

**Teste 2: Abrir Porta**
```bash
curl -X POST http://192.168.1.72/abrir \
  -H "Authorization: Bearer teste" \
  -H "Content-Type: application/json"
```

**Teste 3: Fechar Porta**
```bash
curl -X POST http://192.168.1.72/fechar \
  -H "Authorization: Bearer teste" \
  -H "Content-Type: application/json"
```

---

## 🐛 Troubleshooting

### Problema: ESP32 não conecta no WiFi

**Solução:**
- Verifique SSID e senha
- Certifique-se que é rede 2.4GHz (ESP32 não suporta 5GHz)
- Aproxime ESP32 do roteador

### Problema: Upload falha

**Solução:**
- Pressione e segure botão BOOT durante upload
- Verifique porta COM selecionada
- Instale drivers USB corretos

### Problema: Erro de compilação

**Solução:**
- Verifique se instalou placa ESP32 corretamente
- Atualize Arduino IDE para versão mais recente
- Reinstale biblioteca ESP32

### Problema: CORS no navegador

**Solução:**
- O código já inclui headers CORS
- Certifique-se que função `handleOptions()` está sendo chamada

---

## 📊 Logs Esperados

### Ao Ligar o ESP32:
```
========================================
ESP32 - Sistema de Gaveteiros
========================================

[PINOS] Configurados:
  - Sensor: GPIO 4
  - Motor:  GPIO 5

[WiFi] Conectando a: MinhaRede
.....
[WiFi] ✓ Conectado!
[WiFi] IP: 192.168.1.72

[HTTP] Servidor iniciado na porta 80
[HTTP] Endpoints disponíveis:
  - GET  /health
  - POST /abrir
  - POST /fechar

========================================
Sistema pronto! Aguardando requisições...
========================================
```

### Ao Receber Comando de Abrir:
```
[POST] /abrir
[MOTOR] Porta ABERTA (trava liberada)
```

### Ao Receber Comando de Fechar:
```
[POST] /fechar
[MOTOR] Comando de fechamento recebido
[SENSOR] Aguardando porta encostar...
[SENSOR] ✓ Porta fechada detectada!
[MOTOR] Trava acionada
========================================
```

---

## ✅ Checklist Final

- [ ] Arduino IDE instalado
- [ ] Placa ESP32 instalada no Arduino IDE
- [ ] Código copiado e editado (WiFi, senha, token)
- [ ] ESP32 conectado via USB
- [ ] Upload realizado com sucesso
- [ ] Monitor Serial mostra IP do ESP32
- [ ] Arquivo `.env` atualizado com IP correto
- [ ] Teste /health funcionando
- [ ] Sensor de porta conectado
- [ ] Motor/relé conectado
- [ ] Sistema web testado e funcionando

---

## 🎯 Próximos Passos

Depois que tudo estiver funcionando:

1. Remova os valores hardcoded do código (linhas 22-26 do GaveteiroCompacto.tsx)
2. Reinicie o servidor web
3. Teste o fluxo completo: confirmar ocupação → porta abre → aguarda → porta fecha
4. Monitore os logs no Serial Monitor do ESP32

**Pronto! Seu sistema de gaveteiros com ESP32 está completo!** 🎉
