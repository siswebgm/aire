#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <Ethernet.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>
#include <Preferences.h>
#include "mbedtls/sha256.h"
#include <esp_task_wdt.h>

/* =====================================================
   ESP32 COM DHCP E DESCOBERTA AUTOMÁTICA
   ===================================================== */

// Token SHA256
#define AIRE_ESP_SECRET "AIRE_2025_SUPER_SECRETO"
#define WIFI_RESET_TOKEN "8433135"
#define MAX_TENTATIVAS_WIFI 3
#define TIMEOUT_WIFI 10000
#define INTERVALO_VERIFICACAO_WIFI 30000
#define INTERVALO_LOG_SISTEMA 300000
#define INTERVALO_ANUNCIO 60000 // 1 minuto

// WiFi (sem IP fixo)
const char* WIFI_SSID = "NEW LINK - CAMILLA 2G";
const char* WIFI_PASSWORD = "NG147068";

// Ethernet (DHCP - sem IP fixo)
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
#define ETH_CS_PIN  15
#define ETH_RST_PIN -1

/* =====================================================
   PORTAS (MCP23017)
   ===================================================== */

#define NUM_PORTAS 8
#define TEMPO_PULSO 400
#define SENSOR_DEBOUNCE_MS 300

// Relé ativo em LOW
const bool RELE_ATIVO_EM_HIGH = false;
const uint8_t RELE_LIGADO    = RELE_ATIVO_EM_HIGH ? HIGH : LOW;
const uint8_t RELE_DESLIGADO = RELE_ATIVO_EM_HIGH ? LOW  : HIGH;

/* =====================================================
   OBJETOS
   ===================================================== */

WebServer server(80);
EthernetServer ethServer(80);
Adafruit_MCP23X17 mcp;
Preferences prefs;

enum ConexaoTipo { NENHUMA, ETHERNET, WIFI };
ConexaoTipo conexaoAtiva = NENHUMA;

/* =====================================================
   VARIÁVEIS
   ===================================================== */

bool portaAberta[NUM_PORTAS] = {false};
bool pulsoAtivo[NUM_PORTAS]  = {false};
unsigned long tempoInicioPulso[NUM_PORTAS] = {0};

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
  return id.toUpperCase();
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
   CONEXÃO COM DHCP
   ===================================================== */
bool conectarEthernet() {
  Serial.println("[AIRE] Tentando conectar Ethernet (DHCP)...");
  
  SPI.begin();
  Ethernet.init(ETH_CS_PIN);
  
  // Usa DHCP em vez de IP fixo
  if (Ethernet.begin(mac) == 0) {
    Serial.println("[AIRE] ❌ Falha no DHCP Ethernet");
    return false;
  }
  
  delay(1000);
  
  if (Ethernet.linkStatus() == LinkON) {
    currentIP = Ethernet.localIP().toString();
    Serial.println("[AIRE] ✅ Ethernet conectada via DHCP!");
    Serial.print("[AIRE] IP: ");
    Serial.println(currentIP);
    conexaoAtiva = ETHERNET;
    return true;
  }
  
  Serial.println("[AIRE] ❌ Link Ethernet desconectado");
  return false;
}

bool conectarWiFi() {
  Serial.println("[AIRE] Conectando ao WiFi (DHCP)...");
  Serial.println("[AIRE] SSID: " + String(WIFI_SSID));

  // Configura hostname baseado no ID
  hostname = "AIRE-ESP32-" + deviceId;
  WiFi.setHostname(hostname.c_str());

  WiFi.mode(WIFI_STA);
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
    Serial.print("[AIRE] Hostname: ");
    Serial.println(hostname);
    Serial.print("[AIRE] RSSI: ");
    Serial.println(WiFi.RSSI());
    
    conexaoAtiva = WIFI;
    return true;
  }

  Serial.println("\n[AIRE] ❌ Falha na conexão WiFi");
  return false;
}

void verificarConexaoWiFi() {
  if (conexaoAtiva == WIFI && WiFi.status() != WL_CONNECTED && millis() - ultimaVerificacaoWiFi > INTERVALO_VERIFICACAO_WIFI) {
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
   SISTEMA DE ANÚNCIO E DESCOBERTA
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
        "\"conexao\":\"" + String(conexaoAtiva == ETHERNET ? "ethernet" : "wifi") + "\","
        "\"timestamp\":" + String(millis()) +
        "}";
      
      udp.beginPacket("255.255.255.255", 8889);
      udp.write(anuncio.c_str());
      udp.endPacket();
      
      Serial.println("[AIRE] 📡 Anúncio enviado: " + deviceName + " (" + currentIP + ")");
      ultimoAnuncio = millis();
    }
  }
}

/* =====================================================
   FUNÇÕES DE PORTA (mesmas do original)
   ===================================================== */

void abrirPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  mcp.digitalWrite(8 + i, RELE_LIGADO);
  portaAberta[i] = true;
  pulsoAtivo[i] = true;
  tempoInicioPulso[i] = millis();

  Serial.printf("[AIRE] Porta %d ABERTA\n", porta);
}

void fecharPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  mcp.digitalWrite(8 + i, RELE_DESLIGADO);
  portaAberta[i] = false;
  pulsoAtivo[i] = false;

  Serial.printf("[AIRE] Porta %d FECHADA\n", porta);
}

void verificarPulsos() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i] && agora - tempoInicioPulso[i] >= TEMPO_PULSO) {
      mcp.digitalWrite(8 + i, RELE_DESLIGADO);
      pulsoAtivo[i] = false;
      portaAberta[i] = false;
      Serial.printf("[AIRE] Porta %d FECHADA (pulso de %dms)\n", i + 1, TEMPO_PULSO);
    }
  }
}

void atualizarSensores() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    bool leitura = (mcp.digitalRead(i) == LOW);

    if (leitura != sensorEstadoAnterior[i] &&
        agora - sensorUltimoDebounce[i] > SENSOR_DEBOUNCE_MS) {

      sensorEstadoAnterior[i] = leitura;
      sensorFechado[i] = leitura;
      sensorUltimoDebounce[i] = agora;

      Serial.print("[SENSOR] Porta ");
      Serial.print(i + 1);
      Serial.print(" => ");
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
   ROTAS COM DESCOBERTA
   ===================================================== */

void handleDiscovery() {
  String json = "{"
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"ip\":\"" + currentIP + "\","
    "\"hostname\":\"" + hostname + "\","
    "\"conexao\":\"" + String(conexaoAtiva == ETHERNET ? "ethernet" : conexaoAtiva == WIFI ? "wifi" : "nenhuma") + "\","
    "\"status\":\"online\","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"timestamp\":" + String(millis()) +
    "}";
  
  server.send(200, "application/json", json);
}

void handleStatus() {
  String json = "{"
    "\"conexao\":\"" + String(conexaoAtiva == ETHERNET ? "ethernet" : conexaoAtiva == WIFI ? "wifi" : "nenhuma") + "\","
    "\"ip\":\"" + currentIP + "\","
    "\"hostname\":\"" + hostname + "\","
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\"";
  
  if (conexaoAtiva == WIFI) {
    json += ",\"ssid\":\"" + WiFi.SSID() + "\","
    "\"rssi\":" + String(WiFi.RSSI());
  }
  
  json += ",\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"portas\":[";
    
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (i > 0) json += ",";
    json += "{\"porta\":" + String(i + 1) + 
           ",\"estado\":\"" + String(portaAberta[i] ? "aberta" : "fechada") + 
           "\",\"sensor\":\"" + String(sensorFechado[i] ? "fechado" : "aberto") + 
           "\",\"pulso\":" + String(pulsoAtivo[i] ? "true" : "false") + "}";
  }
  
  json += "],"
    "\"timestamp\":" + String(millis()) +
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
  Serial.printf("[AIRE] ✅ Abrindo porta %d\n", porta);
  
  abrirPorta(porta);

  String response = "{\"ok\":true,\"porta\":" + String(porta) + ",\"timestamp\":" + String(millis()) + "}";
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
  Serial.printf("[AIRE] Fechando porta %d\n", porta);
  
  fecharPorta(porta);

  String response = "{\"ok\":true,\"porta\":" + String(porta) + ",\"timestamp\":" + String(millis()) + "}";
  server.send(200, "application/json", response);
}

void handleIdentify() {
  Serial.println("[AIRE] 🔍 REQUISIÇÃO DE IDENTIFICAÇÃO RECEBIDA");
  
  // Pisca LED builtin para identificação física
  for(int i = 0; i < 5; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(200);
    digitalWrite(LED_BUILTIN, LOW);
    delay(200);
  }
  
  String response = "{\"ok\":true,\"message\":\"Device identificado: " + deviceName + "\",\"led_blink\":true}";
  server.send(200, "application/json", response);
}

/* =====================================================
   LOG DO SISTEMA
   ===================================================== */
void logSistema() {
  Serial.println("[AIRE] === STATUS DO SISTEMA ===");
  Serial.println("[AIRE] Device: " + deviceName);
  Serial.println("[AIRE] ID: " + deviceId);
  Serial.println("[AIRE] Hostname: " + hostname);
  Serial.println("[AIRE] Conexão: " + String(conexaoAtiva == ETHERNET ? "Ethernet" : conexaoAtiva == WIFI ? "WiFi" : "Nenhuma"));
  Serial.println("[AIRE] IP: " + currentIP);
  
  if (conexaoAtiva == WIFI) {
    Serial.println("[AIRE] SSID: " + WiFi.SSID());
    Serial.println("[AIRE] RSSI: " + String(WiFi.RSSI()) + " dBm");
  }
  
  Serial.println("[AIRE] Uptime: " + String(millis() / 1000) + "s");
  Serial.println("[AIRE] Memória Livre: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("[AIRE] ===========================");
}

/* =====================================================
   SETUP
   ===================================================== */
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configura LED builtin
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  Serial.println("\n=== AIRE ESP32 DHCP AUTOMÁTICO ===");
  
  // Gera identificação única
  deviceId = gerarDeviceId();
  deviceName = "AIRE-ESP32-" + deviceId;
  hostname = "AIRE-ESP32-" + deviceId;
  
  Serial.println("[AIRE] Device ID: " + deviceId);
  Serial.println("[AIRE] Device Name: " + deviceName);
  Serial.println("[AIRE] Hostname: " + hostname);

  // Inicializa watchdog
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = 5000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("[AIRE] Watchdog configurado");

  // I2C
  Wire.begin(21, 22);
  Serial.println("[AIRE] I2C configurado");

  // MCP
  if (mcp.begin_I2C(0x20)) {
    Serial.println("[AIRE] MCP23017 encontrado");
  } else {
    Serial.println("[AIRE] ❌ MCP23017 não encontrado!");
    while(1) delay(1000);
  }

  // Configura portas do MCP
  for(int i = 0; i < NUM_PORTAS; i++){
    mcp.pinMode(i, INPUT_PULLUP);   // GPA sensores
    mcp.pinMode(8+i, OUTPUT);       // GPB relés
    mcp.digitalWrite(8+i, RELE_DESLIGADO);
  }
  Serial.println("[AIRE] Portas MCP configuradas");

  // Tenta conexões com DHCP
  Serial.println("[AIRE] Tentando conexões com DHCP...");
  
  if(!conectarEthernet()) {
    Serial.println("[AIRE] Ethernet DHCP falhou, tentando WiFi DHCP...");
    if(!conectarWiFi()) {
      Serial.println("[AIRE] ❌ Todas as conexões DHCP falharam, reiniciando...");
      delay(5000);
      ESP.restart();
    }
  }

  // Configura servidor web
  server.on("/discovery", handleDiscovery);
  server.on("/status", handleStatus);
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
  
  Serial.println("[AIRE] ✅ Sistema DHCP pronto!");
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
  
  // LED indica status
  if (currentIP != "") {
    digitalWrite(LED_BUILTIN, millis() % 2000 < 1000); // Piscando lento
  } else {
    digitalWrite(LED_BUILTIN, millis() % 500 < 250); // Piscando rápido
  }
  
  server.handleClient();
  delay(10);
}
