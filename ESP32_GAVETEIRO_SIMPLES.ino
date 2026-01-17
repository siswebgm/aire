#include <WiFi.h>
#include <WebServer.h>
 #include <WiFiUdp.h>
 #include "mbedtls/sha256.h"
 #include "esp_task_wdt.h"

/* =====================================================
   ESP32 SIMPLES - SEM MCP23017
   Portas direto no ESP32 + DHCP + Descoberta Automática
   ===================================================== */

// Token SHA256
#define AIRE_ESP_SECRET "AIRE_2025_SUPER_SECRETO"
#define WIFI_RESET_TOKEN "8433135"
#define MAX_TENTATIVAS_WIFI 3
#define TIMEOUT_WIFI 10000
#define INTERVALO_VERIFICACAO_WIFI 30000
#define INTERVALO_LOG_SISTEMA 300000
#define INTERVALO_ANUNCIO 60000

// WiFi
const char* WIFI_SSID = "NEW LINK - CAMILLA 2G";
const char* WIFI_PASSWORD = "NG147068";

const char* FW_VERSION = "AIRE-ESP32-SIMPLES-2026-01-04";

// Se false: usa DHCP (recomendado) e você confirma o IP via /discovery, /identify ou Serial
const bool USE_STATIC_IP = false;

IPAddress STATIC_IP(192, 168, 1, 75);
IPAddress STATIC_GATEWAY(192, 168, 1, 254);
IPAddress STATIC_SUBNET(255, 255, 255, 0);
IPAddress STATIC_DNS1(192, 168, 1, 254);
IPAddress STATIC_DNS2(8, 8, 8, 8);

/* =====================================================
   CONFIGURAÇÕES DAS PORTAS (DIRETO NO ESP32)
   ===================================================== */

#define NUM_PORTAS 4
#define TEMPO_PULSO 500

// Portas GPIO para os relés (conforme seu hardware atual)
const uint8_t PORTAS_RELE[NUM_PORTAS] = {26, 27, 21, 22};

// Portas GPIO para os sensores (conforme seu hardware atual)
const uint8_t PORTAS_SENSOR[NUM_PORTAS] = {18, 19, 23, 4};

// Relé ativo em HIGH (fechadura ABRE em HIGH, FECHA em LOW)
const bool RELE_ATIVO_EM_HIGH = false;
const uint8_t RELE_LIGADO    = LOW;
const uint8_t RELE_DESLIGADO = HIGH;

/* =====================================================
   OBJETOS
   ===================================================== */

WebServer server(80);

/* =====================================================
   VARIÁVEIS
   ===================================================== */

bool pulsoAtivo[NUM_PORTAS]  = {false};
unsigned long tempoInicioPulso[NUM_PORTAS] = {0};

bool portaAberta[NUM_PORTAS] = {false};

bool sensorFechado[NUM_PORTAS] = {false};
bool sensorEstadoAnterior[NUM_PORTAS] = {false};
unsigned long sensorUltimoDebounce[NUM_PORTAS] = {0};

unsigned long ultimaVerificacaoWiFi = 0;
unsigned long ultimoLogSistema = 0;
unsigned long ultimoAnuncio = 0;

// Identificação do dispositivo
String deviceId = "";
String deviceName = "";
String currentIP = "";
String hostname = "";

/* =====================================================
   GERAÇÃO DE ID ÚNICO
   ===================================================== */
String gerarDeviceId() {
  uint64_t chipid = ESP.getEfuseMac();
  String id = "";
  for (int i = 0; i < 6; i++) {
    if (chipid >> (8 * (5 - i)) & 0xFF) {
      id += String((chipid >> (8 * (5 - i)) & 0xFF), HEX);
    }
  }
  id.toUpperCase();
  return id;
}

/* =====================================================
   SHA256
   ===================================================== */
String sha256(String input) {
  byte hash[32];
  mbedtls_sha256_context ctx;

  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);
  mbedtls_sha256_update(&ctx, (const unsigned char*)input.c_str(), input.length());
  mbedtls_sha256_finish(&ctx, hash);
  mbedtls_sha256_free(&ctx);

  String hex = "";
  for (int i = 0; i < 32; i++) {
    if (hash[i] < 16) hex += "0";
    hex += String(hash[i], HEX);
  }
  return hex;
}

/* =====================================================
   CONEXÃO WiFi COM DHCP
   ===================================================== */
bool conectarWiFi() {
  Serial.println("[AIRE] Conectando ao WiFi...");
  Serial.println("[AIRE] SSID: " + String(WIFI_SSID));

  // Gera nome único
  deviceId = gerarDeviceId();
  deviceName = "AIRE-ESP32-" + deviceId;
  hostname = "AIRE-ESP32-" + deviceId;
  
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostname.c_str());

  if (USE_STATIC_IP) {
    if (!WiFi.config(STATIC_IP, STATIC_GATEWAY, STATIC_SUBNET, STATIC_DNS1, STATIC_DNS2)) {
      Serial.println("[AIRE] ❌ Falha ao configurar IP estático (seguindo com DHCP)");
    } else {
      Serial.print("[AIRE] IP estático configurado: ");
      Serial.println(STATIC_IP);
    }
  } else {
    Serial.println("[AIRE] DHCP habilitado (sem IP estático)");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    currentIP = WiFi.localIP().toString();
    Serial.println("\n[AIRE] ✅ WiFi conectado via DHCP!");
    Serial.print("[AIRE] IP: ");
    Serial.println(currentIP);
    Serial.print("[AIRE] Device Name: ");
    Serial.println(deviceName);
    Serial.print("[AIRE] Hostname: ");
    Serial.println(hostname);
    Serial.print("[AIRE] RSSI: ");
    Serial.println(WiFi.RSSI());
    
    return true;
  }

  Serial.println("\n[AIRE] ❌ Falha na conexão WiFi");
  return false;
}

void verificarConexaoWiFi() {
  if (WiFi.status() != WL_CONNECTED && millis() - ultimaVerificacaoWiFi > INTERVALO_VERIFICACAO_WIFI) {
    Serial.println("[AIRE] WiFi desconectado, tentando reconectar automaticamente...");
    if (conectarWiFi()) {
      Serial.println("[AIRE] ✅ Reconexão WiFi bem-sucedida!");
    } else {
      Serial.println("[AIRE] ❌ Falha na reconexão WiFi");
    }
    ultimaVerificacaoWiFi = millis();
  }
}

/* =====================================================
   SISTEMA DE ANÚNCIO
   ===================================================== */
void anunciarDispositivo() {
  if (millis() - ultimoAnuncio > INTERVALO_ANUNCIO && currentIP != "") {
    // Envia anúncio via broadcast
    WiFiUDP udp;
    if (udp.begin(8889) == 1) {
      String anuncio = "{"
        "\"type\":\"anuncio\","
        "\"device\":\"" + deviceName + "\","
        "\"id\":\"" + deviceId + "\","
        "\"ip\":\"" + currentIP + "\","
        "\"hostname\":\"" + hostname + "\","
        "\"conexao\":\"wifi\","
        "\"timestamp\":" + String(millis()) +
        "}";
      
      udp.beginPacket("255.255.255.255", 8889);
      udp.write((uint8_t*)anuncio.c_str(), anuncio.length());
      udp.endPacket();
      
      Serial.println("[AIRE] 📡 Anúncio enviado: " + deviceName + " (" + currentIP + ")");
      ultimoAnuncio = millis();
    }
  }
}

/* =====================================================
   FUNÇÃO DE TESTE INICIAL DAS FECHADURAS (SEM ATIVAR)
   ===================================================== */
void testeInicialFechaduras() {
  Serial.println("[AIRE] === TESTE INICIAL DAS FECHADURAS (APENAS VERIFICAÇÃO) ===");
  
  for(int i = 0; i < 4; i++) {  // Testa apenas as 4 primeiras portas
    if (PORTAS_RELE[i] > 0) {
      Serial.printf("[AIRE] Verificando porta %d (GPIO %d):\n", i + 1, PORTAS_RELE[i]);
      
      // Debug especial para portas 1 e 2 (GPIOs 26 e 27)
      if (i == 0 || i == 1) {
        Serial.printf("[AIRE] ⚠️ DEBUG ESPECIAL - Porta %d (GPIO %d)\n", i + 1, PORTAS_RELE[i]);
        Serial.printf("[AIRE] GPIO %d é usado para ADC/DAC no ESP32!\n", PORTAS_RELE[i]);
        
        // ⚠️ NÃO ATIVA O RELÉ - APENAS VERIFICA ESTADO ATUAL
        pinMode(PORTAS_RELE[i], OUTPUT);
        Serial.printf("[AIRE] GPIO %d configurado como OUTPUT\n", PORTAS_RELE[i]);
        
        // Garante que está FECHADO antes de qualquer verificação
        digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
        delay(100);
        
        // Verifica estado atual (sem alterar)
        int estado = digitalRead(PORTAS_RELE[i]);
        Serial.printf("[AIRE] GPIO %d estado atual: %d (%s)\n", 
                      PORTAS_RELE[i], estado, estado == RELE_DESLIGADO ? "FECHADO ✅" : "ABERTO ❌");
        
        // Se ainda estiver aberto, força novamente sem testar HIGH/LOW
        if (estado != RELE_DESLIGADO) {
          Serial.printf("[AIRE] ⚠️ Forçando estado FECHADO para GPIO %d\n", PORTAS_RELE[i]);
          digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
          delay(200);
          
          // Verificação final
          estado = digitalRead(PORTAS_RELE[i]);
          Serial.printf("[AIRE] Após força - GPIO %d: %d (%s)\n", 
                        PORTAS_RELE[i], estado, estado == RELE_DESLIGADO ? "FECHADO ✅" : "ABERTO ❌");
        } else {
          Serial.printf("[AIRE] ✅ GPIO %d já está FECHADO\n", PORTAS_RELE[i]);
        }
      } else {
        // Para portas 3 e 4, apenas verifica
        digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
        delay(50);
        int estado = digitalRead(PORTAS_RELE[i]);
        Serial.printf("[AIRE] Porta %d (GPIO %d): %s\n", 
                      i + 1, PORTAS_RELE[i], estado == RELE_DESLIGADO ? "FECHADO ✅" : "ABERTO ❌");
      }
    }
  }
  
  Serial.println("[AIRE] === FIM DO TESTE INICIAL (NENHUMA PORTA ATIVADA) ===");
}

/* =====================================================
   FUNÇÕES DAS PORTAS (DIRETO NO ESP32)
   ===================================================== */

void abrirPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  Serial.printf("[AIRE] Abrindo porta %d (GPIO %d)\n", porta, PORTAS_RELE[i]);
  Serial.printf("[AIRE] RELE_LIGADO = %d\n", RELE_LIGADO);
  Serial.printf("[AIRE] Estado antes: %d\n", digitalRead(PORTAS_RELE[i]));
  
  digitalWrite(PORTAS_RELE[i], RELE_LIGADO);
  portaAberta[i] = true;
  pulsoAtivo[i] = true;
  tempoInicioPulso[i] = millis();

  Serial.printf("[AIRE] Estado depois: %d\n", digitalRead(PORTAS_RELE[i]));
  Serial.printf("[AIRE] Porta %d ABERTA (GPIO %d)\n", porta, PORTAS_RELE[i]);
}

void fecharPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
  portaAberta[i] = false;
  pulsoAtivo[i] = false;

  Serial.printf("[AIRE] Porta %d FECHADA (GPIO %d)\n", porta, PORTAS_RELE[i]);
}

void verificarPulsos() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i] && agora - tempoInicioPulso[i] >= TEMPO_PULSO) {
      digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
      pulsoAtivo[i] = false;
      portaAberta[i] = false;
      Serial.printf("[AIRE] Porta %d FECHADA (pulso de %dms)\n", i + 1, TEMPO_PULSO);
    }
  }
}

void atualizarSensores() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    bool leitura = (digitalRead(PORTAS_SENSOR[i]) == LOW);

    if (leitura != sensorEstadoAnterior[i] &&
        agora - sensorUltimoDebounce[i] > 50) { // 50ms debounce

      sensorEstadoAnterior[i] = leitura;
      sensorFechado[i] = leitura;
      sensorUltimoDebounce[i] = agora;

      Serial.print("[SENSOR] Porta ");
      Serial.print(i + 1);
      Serial.print(" (GPIO ");
      Serial.print(PORTAS_SENSOR[i]);
      Serial.print(") => ");
      Serial.println(leitura ? "FECHADO" : "ABERTO");
    }
  }
}

/* =====================================================
   AUTENTICAÇÃO
   ===================================================== */

bool autorizado() {
  if (!server.hasArg("condominio_uid") ||
      !server.hasArg("porta_uid") ||
      !server.hasArg("porta") ||
      !server.hasArg("token")) return false;

  String base =
    server.arg("condominio_uid") + ":" +
    server.arg("porta_uid") + ":" +
    server.arg("porta") + ":" +
    AIRE_ESP_SECRET;

  return sha256(base).equalsIgnoreCase(server.arg("token"));
}

bool autorizadoResetWifi() {
  if (!server.hasArg("token")) return false;
  return server.arg("token") == WIFI_RESET_TOKEN;
}

/* =====================================================
   ROTAS
   ===================================================== */

void handleDiscovery() {
  String json = "{"
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"fw_version\":\"" + String(FW_VERSION) + "\","
    "\"ip\":\"" + currentIP + "\","
    "\"hostname\":\"" + hostname + "\","
    "\"conexao\":\"wifi\","
    "\"status\":\"online\","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"hardware\":\"esp32_direto\","
    "\"portas_gpio\":{"
      "\"reles\":[" + String(PORTAS_RELE[0]) + "," + String(PORTAS_RELE[1]) + "," + String(PORTAS_RELE[2]) + "," + String(PORTAS_RELE[3]) + "," + String(PORTAS_RELE[4]) + "," + String(PORTAS_RELE[5]) + "," + String(PORTAS_RELE[6]) + "," + String(PORTAS_RELE[7]) + "],"
      "\"sensores\":[" + String(PORTAS_SENSOR[0]) + "," + String(PORTAS_SENSOR[1]) + "," + String(PORTAS_SENSOR[2]) + "," + String(PORTAS_SENSOR[3]) + "," + String(PORTAS_SENSOR[4]) + "," + String(PORTAS_SENSOR[5]) + "," + String(PORTAS_SENSOR[6]) + "," + String(PORTAS_SENSOR[7]) + "]"
    "},"
    "\"timestamp\":" + String(millis()) +
    "}";
  
  server.send(200, "application/json", json);
}

void handleStatus() {
  String json = "{"
    "\"conexao\":\"wifi\","
    "\"ip\":\"" + currentIP + "\","
    "\"hostname\":\"" + hostname + "\","
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"fw_version\":\"" + String(FW_VERSION) + "\","
    "\"ssid\":\"" + WiFi.SSID() + "\","
    "\"rssi\":" + String(WiFi.RSSI()) + ","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"hardware\":\"esp32_direto\","
    "\"portas\":[";
    
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (i > 0) json += ",";
    json += "{\"porta\":" + String(i + 1) + 
           ",\"estado\":\"" + String(portaAberta[i] ? "aberta" : "fechada") + 
           ",\"sensor\":\"" + String(sensorFechado[i] ? "fechado" : "aberto") + 
           ",\"pulso\":" + String(pulsoAtivo[i] ? "true" : "false") + 
           ",\"gpio_rele\":" + String(PORTAS_RELE[i]) + 
           ",\"gpio_sensor\":" + String(PORTAS_SENSOR[i]) + "}";
  }
  
  json += "],"
    "\"timestamp\":" + String(millis()) +
    "}";
  
  server.send(200, "application/json", json);
}

void handleSensor() {
  if (!server.hasArg("porta")) {
    server.send(400, "application/json", "{\"erro\":\"porta_obrigatoria\"}");
    return;
  }

  int porta = server.arg("porta").toInt();
  
  if (porta < 1 || porta > NUM_PORTAS) {
    server.send(400, "application/json", "{\"erro\":\"porta_invalida\"}");
    return;
  }

  int i = porta - 1;
  int gpio = PORTAS_SENSOR[i];
  int raw = digitalRead(gpio);
  bool fechado = (raw == LOW);

  String json = "{" 
    "\"porta\":" + String(porta) + "," 
    "\"gpio_sensor\":" + String(gpio) + "," 
    "\"raw\":" + String(raw) + "," 
    "\"sensor\":\"" + String(fechado ? "fechado" : "aberto") + "\"," 
    "\"timestamp\":" + String(millis()) + "," 
    "\"fw_version\":\"" + String(FW_VERSION) + "\"" 
    "}";

  server.send(200, "application/json", json);
}

void handleAbrir() {
  if (!autorizado()) {
    server.send(401, "application/json", "{\"erro\":\"nao_autorizado\"}");
    return;
  }

  int porta = server.arg("porta").toInt();
  
  if (porta < 1 || porta > NUM_PORTAS) {
    server.send(400, "application/json", "{\"erro\":\"porta_invalida\"}");
    return;
  }

  Serial.println("[AIRE] Requisição para abrir porta recebida");
  Serial.printf("[AIRE] ✅ Abrindo porta %d (GPIO %d)\n", porta, PORTAS_RELE[porta-1]);
  
  abrirPorta(porta);

  String response = "{\"ok\":true,\"porta\":" + String(porta) + ",\"gpio_rele\":" + String(PORTAS_RELE[porta-1]) + ",\"timestamp\":" + String(millis()) + "}";
  server.send(200, "application/json", response);
}

void handleFechar() {
  if (!autorizado()) {
    server.send(401, "application/json", "{\"erro\":\"nao_autorizado\"}");
    return;
  }

  int porta = server.arg("porta").toInt();
  
  if (porta < 1 || porta > NUM_PORTAS) {
    server.send(400, "application/json", "{\"erro\":\"porta_invalida\"}");
    return;
  }

  Serial.println("[AIRE] Requisição para fechar porta recebida");
  Serial.printf("[AIRE] Fechando porta %d (GPIO %d)\n", porta, PORTAS_RELE[porta-1]);
  
  fecharPorta(porta);

  String response = "{\"ok\":true,\"porta\":" + String(porta) + ",\"gpio_rele\":" + String(PORTAS_RELE[porta-1]) + ",\"timestamp\":" + String(millis()) + "}";
  server.send(200, "application/json", response);
}

void handleIdentify() {
  Serial.println("[AIRE] 🔍 REQUISIÇÃO DE IDENTIFICAÇÃO RECEBIDA");
  
  // Pisca LED builtin para identificação física
  // ESP32 não tem LED_BUILTIN padrão, usa GPIO 2
  const int LED_PIN = 2;
  pinMode(LED_PIN, OUTPUT);
  
  for(int i = 0; i < 5; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
  
  String response = "{"
    "\"ok\":true,"
    "\"message\":\"Device identificado: " + deviceName + "\","
    "\"led_blink\":true,"
    "\"hardware\":\"esp32_direto\","
    "\"ip\":\"" + currentIP + "\""
  "}";
  server.send(200, "application/json", response);
}

/* =====================================================
   LOG DO SISTEMA
   ===================================================== */
void logSistema() {
  Serial.println("[AIRE] === STATUS DO SISTEMA ===");
  Serial.println("[AIRE] Device: " + deviceName);
  Serial.println("[AIRE] ID: " + deviceId);
  Serial.println("[AIRE] Hardware: ESP32 Direto (sem MCP23017)");
  Serial.println("[AIRE] IP: " + currentIP);
  Serial.println("[AIRE] SSID: " + WiFi.SSID());
  Serial.println("[AIRE] RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("[AIRE] Uptime: " + String(millis() / 1000) + "s");
  Serial.println("[AIRE] Memória Livre: " + String(ESP.getFreeHeap()) + " bytes");
  
  Serial.println("[AIRE] Portas - Relés:");
  for (int i = 0; i < NUM_PORTAS; i++) {
    Serial.printf("[AIRE]   Porta %d: GPIO %d (Relé) | GPIO %d (Sensor)\n", 
                  i + 1, PORTAS_RELE[i], PORTAS_SENSOR[i]);
  }
  
  Serial.println("[AIRE] ===========================");
}

/* =====================================================
   SETUP
   ===================================================== */
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configura LED builtin (ESP32 não tem LED_BUILTIN padrão)
  const int LED_PIN = 2;           // LED builtin
  const int LED_PIN_EXTERNO = 33;  // LED externo (opcional)
  pinMode(LED_PIN, OUTPUT);
  pinMode(LED_PIN_EXTERNO, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(LED_PIN_EXTERNO, LOW);

  Serial.println("\n=== AIRE ESP32 SIMPLES (SEM MCP23017) ===");
  
  // Inicializa watchdog
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = 5000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("[AIRE] Watchdog configurado");

  // Configura portas dos relés (apenas as portas em uso)
  for(int i = 0; i < NUM_PORTAS; i++){
    if (PORTAS_RELE[i] > 0) {  // ✅ Só configura se GPIO for válido
      // ⚠️ Evita glitch no boot: define nível primeiro, depois habilita OUTPUT
      digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
      pinMode(PORTAS_RELE[i], OUTPUT);
      
      // ⚠️ FORÇA ESTADO FECHADO IMEDIATAMENTE (LOW = FECHADO)
      digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);  // LOW = FECHADO
      delay(100); // Delay maior para estabilizar
      
      // ⚠️ PROTEÇÃO ESPECIAL PARA PORTAS 1 e 2 (GPIOs 26/27)
      if (i == 0 || i == 1) {
        Serial.printf("[AIRE] 🛡️ PROTEÇÃO ESPECIAL - Forçando porta %d (GPIO %d) FECHADA\n", i + 1, PORTAS_RELE[i]);
        
        // Força múltiplas vezes para garantir
        for(int j = 0; j < 5; j++) {
          digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);  // LOW = FECHADO
          delay(50);
        }
        
        // Verificação
        int estado = digitalRead(PORTAS_RELE[i]);
        Serial.printf("[AIRE] Porta %d após proteção: %d (%s)\n", 
                      i + 1, estado, estado == RELE_DESLIGADO ? "FECHADO ✅" : "ABERTO ❌");
      }
      
      // Verificação imediata para todas
      int estado = digitalRead(PORTAS_RELE[i]);
      Serial.printf("[AIRE] Relé porta %d configurado no GPIO %d (estado: %s)\n", 
                    i + 1, PORTAS_RELE[i], estado == RELE_DESLIGADO ? "FECHADO ✅" : "ABERTO ❌");
      
      // Se ainda estiver aberto, força novamente
      if (estado != RELE_DESLIGADO) {
        Serial.printf("[AIRE] ⚠️ Forçando estado FECHADO novamente para GPIO %d\n", PORTAS_RELE[i]);
        digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
        delay(200);
      }
    }
  }
  Serial.println("[AIRE] Portas dos relés configuradas - TODAS FORÇADAS FECHADAS");

  // Configura portas dos sensores (apenas as portas em uso)
  for(int i = 0; i < NUM_PORTAS; i++){
    if (PORTAS_SENSOR[i] > 0) {  // ✅ Só configura se GPIO for válido
      pinMode(PORTAS_SENSOR[i], INPUT_PULLUP);
      Serial.printf("[AIRE] Sensor porta %d configurado no GPIO %d\n", i + 1, PORTAS_SENSOR[i]);
    }
  }
  Serial.println("[AIRE] Portas dos sensores configuradas");

  // Teste inicial das fechaduras
  testeInicialFechaduras();
  
  // ⚠️ VERIFICAÇÃO FINAL - Garante que todas as portas estão FECHADAS
  Serial.println("[AIRE] === VERIFICAÇÃO FINAL - TODAS FECHADURAS FECHADAS ===");
  for(int i = 0; i < 4; i++) {
    if (PORTAS_RELE[i] > 0) {
      // Proteção extra para portas 1 e 2
      if (i == 0 || i == 1) {
        Serial.printf("[AIRE] 🛡️ VERIFICAÇÃO EXTRA - Porta %d (GPIO %d)\n", i + 1, PORTAS_RELE[i]);
        
        // Força estado FECHADO 3 vezes
        for(int k = 0; k < 3; k++) {
          digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);  // LOW = FECHADO
          delay(100);
        }
      }
      
      digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
      delay(100);
      int estado = digitalRead(PORTAS_RELE[i]);
      Serial.printf("[AIRE] Porta %d (GPIO %d): %d (%s)\n", 
                    i + 1, PORTAS_RELE[i], estado, estado == RELE_DESLIGADO ? "FECHADO ✅" : "ABERTO ❌");
      
      // Se ainda estiver aberto, alerta
      if (estado != RELE_DESLIGADO) {
        Serial.printf("[AIRE] 🚨 ALERTA - Porta %d ainda está ABERTA! Forçando novamente...\n", i + 1);
        for(int l = 0; l < 10; l++) {
          digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
          delay(50);
        }
      }
    }
  }
  Serial.println("[AIRE] === FIM DA VERIFICAÇÃO FINAL ===");

  // Conecta WiFi
  if(!conectarWiFi()) {
    Serial.println("[AIRE] ❌ Falha na conexão WiFi, reiniciando...");
    delay(5000);
    ESP.restart();
  }

  // Configura servidor web
  server.on("/discovery", handleDiscovery);
  server.on("/status", handleStatus);
  server.on("/sensor", handleSensor);
  server.on("/abrir", handleAbrir);
  server.on("/fechar", handleFechar);
  server.on("/identify", handleIdentify);
  
  // Adiciona CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  server.begin();
  Serial.println("[AIRE] Servidor HTTP iniciado na porta 80");
  
  // Log inicial
  logSistema();
  
  Serial.println("[AIRE] ✅ Sistema simples pronto!");
  Serial.println("[AIRE] Acesse: http://" + currentIP + "/discovery");
}

/* =====================================================
   LOOP
   ===================================================== */
void loop() {
  verificarPulsos();
  atualizarSensores();
  
  // Verificar WiFi periodicamente
  verificarConexaoWiFi();
  
  // Anunciar dispositivo periodicamente
  anunciarDispositivo();
  
  // Log periódico
  if (millis() - ultimoLogSistema > INTERVALO_LOG_SISTEMA) {
    logSistema();
    ultimoLogSistema = millis();
  }
  
  // Reset watchdog
  esp_task_wdt_reset();
  
  // LED indica status (ESP32 não tem LED_BUILTIN padrão)
  const int LED_PIN = 2;
  const int LED_PIN_EXTERNO = 33;

  if (WiFi.status() == WL_CONNECTED) {
    bool ledState = millis() % 2000 < 1000; // Piscando lento quando conectado
    digitalWrite(LED_PIN, ledState);
    digitalWrite(LED_PIN_EXTERNO, ledState);
  } else {
    digitalWrite(LED_PIN, millis() % 500 < 250);         // Piscando rápido
    digitalWrite(LED_PIN_EXTERNO, millis() % 500 < 250); // Piscando rápido
  }
  
  server.handleClient();
  delay(10);
}
