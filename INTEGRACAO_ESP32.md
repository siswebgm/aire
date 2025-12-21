# Integração ESP32 - Sistema de Gaveteiros

## 🔌 Fluxo de Comunicação Implementado

### 1. **Ao Confirmar Ocupação**
Quando o usuário clica em "Confirmar Ocupação":

```
1. Sistema registra ocupação no banco de dados
2. Gera senhas para os destinatários
3. Envia comando HTTP POST /abrir para ESP32
4. Aguarda 2 segundos (tempo para colocar o item)
5. Envia comando HTTP POST /fechar para ESP32
6. ESP32 deve aguardar sensor confirmar fechamento
```

### 2. **Endpoints que o ESP32 deve implementar**

#### **POST /abrir**
Abre a porta do gaveteiro.

**Request:**
```json
POST http://192.168.1.72/abrir
Headers:
  Authorization: Bearer teste
  Content-Type: application/json
Body:
{
  "lockId": 0
}
```

**Response esperada:**
```json
{
  "ok": true,
  "message": "Porta aberta"
}
```

**O que o ESP32 deve fazer:**
1. Validar token Bearer
2. Acionar motor/solenóide para ABRIR a porta
3. Retornar confirmação
4. Aguardar próximo comando

---

#### **POST /fechar**
Fecha a porta do gaveteiro.

**Request:**
```json
POST http://192.168.1.72/fechar
Headers:
  Authorization: Bearer teste
  Content-Type: application/json
Body:
{
  "lockId": 0
}
```

**Response esperada:**
```json
{
  "ok": true,
  "message": "Comando de fechamento enviado"
}
```

**O que o ESP32 deve fazer:**
1. Validar token Bearer
2. Acionar motor/solenóide para FECHAR a porta
3. **Monitorar sensor de proximidade/contato**
4. Quando sensor detectar que porta encostou:
   - Travar a fechadura
   - Enviar confirmação ao sistema (opcional via webhook ou polling)

---

#### **GET /health**
Verifica se o ESP32 está online.

**Request:**
```
GET http://192.168.1.72/health
```

**Response esperada:**
```json
{
  "status": "online",
  "device": "ESP32-GAVETEIRO",
  "uptime": 12345
}
```

---

### 3. **Lógica do Sensor de Porta**

O ESP32 deve ter um sensor (magnético, infravermelho, ou contato) para detectar quando a porta fecha completamente.

**Pseudocódigo:**

```cpp
// Pino do sensor (exemplo: sensor magnético)
#define SENSOR_PIN 4
#define MOTOR_PIN 5

bool portaAberta = false;
bool comandoFechar = false;

void setup() {
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(MOTOR_PIN, OUTPUT);
}

void loop() {
  // Se recebeu comando para fechar
  if (comandoFechar) {
    // Aciona motor para fechar
    digitalWrite(MOTOR_PIN, HIGH);
    
    // Aguarda sensor detectar fechamento
    while (digitalRead(SENSOR_PIN) == HIGH) {
      delay(50); // Porta ainda não encostou
    }
    
    // Sensor detectou que porta encostou
    digitalWrite(MOTOR_PIN, LOW); // Para o motor
    portaAberta = false;
    comandoFechar = false;
    
    Serial.println("[SENSOR] Porta fechada e travada!");
    // Opcional: Enviar confirmação ao sistema
  }
}

// Handler do endpoint /fechar
void handleFechar() {
  if (validarToken()) {
    comandoFechar = true;
    server.send(200, "application/json", "{\"ok\":true,\"message\":\"Comando de fechamento enviado\"}");
  } else {
    server.send(401, "application/json", "{\"error\":\"Token inválido\"}");
  }
}
```

---

### 4. **Configuração CORS (Importante!)**

O ESP32 **DEVE** aceitar requisições do navegador. Configure CORS:

```cpp
server.enableCORS(true);

// Ou manualmente em cada resposta:
server.sendHeader("Access-Control-Allow-Origin", "*");
server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
server.sendHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
```

---

### 5. **Validação de Token**

```cpp
bool validarToken() {
  if (!server.hasHeader("Authorization")) {
    return false;
  }
  
  String authHeader = server.header("Authorization");
  String expectedToken = "Bearer teste"; // Mesmo token do .env
  
  return authHeader == expectedToken;
}
```

---

### 6. **Exemplo Completo - Código ESP32**

```cpp
#include <WiFi.h>
#include <WebServer.h>

// Configurações WiFi
const char* ssid = "SUA_REDE_WIFI";
const char* password = "SUA_SENHA_WIFI";

// Token de autenticação
const char* BEARER_TOKEN = "Bearer teste";

// Pinos
#define SENSOR_PIN 4  // Sensor de porta fechada
#define MOTOR_PIN 5   // Motor/Solenóide

WebServer server(80);
bool comandoFechar = false;

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(MOTOR_PIN, OUTPUT);
  
  // Conectar WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Rotas
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/abrir", HTTP_POST, handleAbrir);
  server.on("/fechar", HTTP_POST, handleFechar);
  
  server.enableCORS(true);
  server.begin();
  Serial.println("Servidor HTTP iniciado!");
}

void loop() {
  server.handleClient();
  
  // Monitorar fechamento da porta
  if (comandoFechar) {
    digitalWrite(MOTOR_PIN, HIGH); // Aciona motor
    
    // Aguarda sensor detectar fechamento
    while (digitalRead(SENSOR_PIN) == HIGH) {
      delay(50);
      server.handleClient(); // Continua respondendo requisições
    }
    
    // Porta encostou!
    digitalWrite(MOTOR_PIN, LOW);
    comandoFechar = false;
    Serial.println("[SENSOR] Porta fechada e travada!");
  }
}

bool validarToken() {
  if (!server.hasHeader("Authorization")) return false;
  return server.header("Authorization") == String(BEARER_TOKEN);
}

void handleHealth() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"status\":\"online\",\"device\":\"ESP32-GAVETEIRO\"}");
}

void handleAbrir() {
  if (!validarToken()) {
    server.send(401, "application/json", "{\"error\":\"Token inválido\"}");
    return;
  }
  
  Serial.println("[CMD] ABRIR porta");
  digitalWrite(MOTOR_PIN, LOW); // Libera trava
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true,\"message\":\"Porta aberta\"}");
}

void handleFechar() {
  if (!validarToken()) {
    server.send(401, "application/json", "{\"error\":\"Token inválido\"}");
    return;
  }
  
  Serial.println("[CMD] FECHAR porta - aguardando sensor...");
  comandoFechar = true;
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true,\"message\":\"Comando de fechamento enviado\"}");
}
```

---

## 🔄 Fluxo Completo

```
USUÁRIO                    SISTEMA WEB                    ESP32                    SENSOR
   |                           |                            |                         |
   |--[Confirmar Ocupação]---->|                            |                         |
   |                           |--[POST /abrir]------------>|                         |
   |                           |                            |--[Abre porta]           |
   |                           |<--[200 OK]-----------------|                         |
   |                           |                            |                         |
   |                           |--[Aguarda 2s]              |                         |
   |                           |                            |                         |
   |                           |--[POST /fechar]----------->|                         |
   |                           |<--[200 OK]-----------------|                         |
   |                           |                            |--[Aciona motor fechar]  |
   |                           |                            |                         |
   |                           |                            |--[Monitora sensor]----->|
   |                           |                            |                         |
   |                           |                            |<--[Porta encostou]------|
   |                           |                            |--[Trava fechadura]      |
   |                           |                            |                         |
```

---

## ✅ Checklist de Implementação

- [ ] ESP32 conectado na rede WiFi
- [ ] IP configurado no `.env` (VITE_ESP32_BASE_URL)
- [ ] Token configurado no ESP32 e no `.env` (VITE_ESP32_TOKEN)
- [ ] Endpoint `/health` funcionando
- [ ] Endpoint `/abrir` funcionando
- [ ] Endpoint `/fechar` funcionando
- [ ] Sensor de porta instalado e testado
- [ ] CORS habilitado no ESP32
- [ ] Motor/Solenóide testado (abrir e fechar)
- [ ] Lógica de travamento ao detectar fechamento

---

## 🧪 Testando

1. Acesse: http://localhost:3001/esp32-teste
2. Configure o IP do ESP32
3. Clique em "Testar /health" - deve retornar "online"
4. Clique em "Abrir (POST /abrir)" - deve abrir a porta
5. No sistema principal, confirme uma ocupação e observe os logs do console

---

## 📝 Variáveis de Ambiente Atuais

```env
VITE_ESP32_BASE_URL=http://192.168.1.72
VITE_ESP32_TOKEN=teste
VITE_ESP32_LOCK_ID=0
```

**Certifique-se de que o IP do ESP32 corresponde ao configurado!**
