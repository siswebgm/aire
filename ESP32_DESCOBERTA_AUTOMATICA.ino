#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include "mbedtls/sha256.h"
#include <esp_task_wdt.h>

/* =====================================================
   SISTEMA DE DESCOBERTA AUTOMÁTICA DE ESP32
   ===================================================== */

#define AIRE_ESP_SECRET "AIRE_2025_SUPER_SECRETO"
#define WIFI_RESET_TOKEN "8433135"
#define MAX_TENTATIVAS_WIFI 3
#define TIMEOUT_WIFI 10000
#define INTERVALO_VERIFICACAO_WIFI 30000
#define INTERVALO_LOG_SISTEMA 300000
#define INTERVALO_PING 60000 // 1 minuto

// WiFi
const char* WIFI_SSID = "NEW LINK - CAMILLA 2G";
const char* WIFI_PASSWORD = "NG147068";

// Configurações de rede
String deviceName = "AIRE-ESP32-";
String deviceId = "";
String lastKnownIP = "";

WebServer server(80);
Preferences prefs;

unsigned long ultimaVerificacaoWiFi = 0;
unsigned long ultimoLogSistema = 0;
unsigned long ultimoPing = 0;
unsigned long tempoInicio = 0;

bool sistemaOnline = false;

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
   WIFI MELHORADO COM PERSISTÊNCIA
   ===================================================== */
bool conectarWiFi() {
  prefs.begin("wifi", true);
  String ssid = prefs.getString("ssid", WIFI_SSID);
  String pass = prefs.getString("pass", WIFI_PASSWORD);
  prefs.end();

  Serial.println("[AIRE] Conectando ao WiFi...");
  Serial.println("[AIRE] SSID: " + ssid);

  // Configura hostname para facilitar descoberta
  WiFi.hostname(deviceName.c_str());

  for (int tentativa = 1; tentativa <= MAX_TENTATIVAS_WIFI; tentativa++) {
    Serial.printf("[AIRE] Tentativa %d/%d\n", tentativa, MAX_TENTATIVAS_WIFI);
    
    WiFi.disconnect(true);
    delay(500);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());

    unsigned long inicio = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI) {
      delay(500);
      Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n[AIRE] ✅ WiFi conectado!");
      Serial.print("[AIRE] IP: ");
      Serial.println(WiFi.localIP());
      Serial.print("[AIRE] Hostname: ");
      Serial.println(WiFi.getHostname());
      Serial.print("[AIRE] RSSI: ");
      Serial.println(WiFi.RSSI());
      
      lastKnownIP = WiFi.localIP().toString();
      sistemaOnline = true;
      
      // Salva IP para recuperação
      prefs.begin("system", false);
      prefs.putString("lastIP", lastKnownIP);
      prefs.end();
      
      return true;
    }

    Serial.printf("\n[AIRE] Falha na tentativa %d\n", tentativa);
    if (tentativa < MAX_TENTATIVAS_WIFI) {
      delay(2000);
    }
  }

  Serial.println("[AIRE] ❌ Todas as tentativas falharam");
  sistemaOnline = false;
  return false;
}

void verificarConexaoWiFi() {
  if (WiFi.status() != WL_CONNECTED && millis() - ultimaVerificacaoWiFi > INTERVALO_VERIFICACAO_WIFI) {
    Serial.println("[AIRE] WiFi desconectado, tentando reconectar...");
    sistemaOnline = false;
    
    if (conectarWiFi()) {
      Serial.println("[AIRE] ✅ Reconexão bem-sucedida!");
    } else {
      Serial.println("[AIRE] ❌ Falha na reconexão");
    }
    ultimaVerificacaoWiFi = millis();
  }
}

/* =====================================================
   SISTEMA DE PING E HEALTH CHECK
   ===================================================== */
void enviarPing() {
  if (millis() - ultimoPing > INTERVALO_PING && sistemaOnline) {
    // Envia ping broadcast para anunciar presença
    WiFiUDP udp;
    udp.begin(8888);
    
    String pingMessage = "{\"type\":\"ping\",\"device\":\"" + deviceName + "\",\"id\":\"" + deviceId + "\",\"ip\":\"" + WiFi.localIP().toString() + "\",\"timestamp\":" + String(millis()) + "}";
    
    // Envia para broadcast
    udp.beginPacket("255.255.255.255", 8888);
    udp.write(pingMessage.c_str());
    udp.endPacket();
    
    Serial.println("[AIRE] 📡 Ping broadcast enviado");
    ultimoPing = millis();
  }
}

/* =====================================================
   LOG DO SISTEMA
   ===================================================== */
void logSistema() {
  Serial.println("[AIRE] === STATUS DO SISTEMA ===");
  Serial.println("[AIRE] Device: " + deviceName);
  Serial.println("[AIRE] ID: " + deviceId);
  Serial.println("[AIRE] Status: " + String(sistemaOnline ? "ONLINE" : "OFFLINE"));
  
  if (sistemaOnline) {
    Serial.println("[AIRE] IP: " + WiFi.localIP().toString());
    Serial.println("[AIRE] SSID: " + WiFi.SSID());
    Serial.println("[AIRE] RSSI: " + String(WiFi.RSSI()) + " dBm");
    Serial.println("[AIRE] Último IP: " + lastKnownIP);
  }
  
  Serial.println("[AIRE] Uptime: " + String(millis() / 1000) + "s");
  Serial.println("[AIRE] Memória Livre: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("[AIRE] ===========================");
}

/* =====================================================
   ROTAS DE DESCOBERTA
   ===================================================== */
void handleDiscovery() {
  String json = "{"
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"ip\":\"" + WiFi.localIP().toString() + "\","
    "\"hostname\":\"" + String(WiFi.getHostname()) + "\","
    "\"status\":\"" + String(sistemaOnline ? "online" : "offline") + "\","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"timestamp\":" + String(millis()) +
    "}";
  
  server.send(200, "application/json", json);
}

void handleStatus() {
  String json = "{"
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"ip\":\"" + WiFi.localIP().toString() + "\","
    "\"hostname\":\"" + String(WiFi.getHostname()) + "\","
    "\"status\":\"" + String(sistemaOnline ? "online" : "offline") + "\","
    "\"ssid\":\"" + WiFi.SSID() + "\","
    "\"rssi\":" + String(WiFi.RSSI()) + ","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"lastIP\":\"" + lastKnownIP + "\","
    "\"timestamp\":" + String(millis()) +
    "}";
  
  server.send(200, "application/json", json);
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
   SETUP
   ===================================================== */
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configura LED builtin
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  Serial.println("\n=== AIRE ESP32 DESCOBERTA AUTOMÁTICA ===");
  
  // Gera ID único
  deviceId = gerarDeviceId();
  deviceName += deviceId;
  
  Serial.println("[AIRE] Device ID: " + deviceId);
  Serial.println("[AIRE] Hostname: " + deviceName);

  // Inicializa watchdog
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = 5000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("[AIRE] Watchdog configurado");

  // Conecta WiFi
  if (!conectarWiFi()) {
    Serial.println("[AIRE] ❌ Falha na conexão WiFi");
  }

  // Configura servidor web
  server.on("/discovery", handleDiscovery);
  server.on("/status", handleStatus);
  server.on("/identify", handleIdentify);
  
  // Adiciona CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  server.begin();
  Serial.println("[AIRE] Servidor HTTP iniciado na porta 80");
  
  // Log inicial
  logSistema();
  
  Serial.println("[AIRE] ✅ Sistema de descoberta pronto!");
  Serial.println("[AIRE] Acesse: http://" + WiFi.localIP().toString() + "/discovery");
}

/* =====================================================
   LOOP
   ===================================================== */
void loop() {
  // Verifica WiFi
  verificarConexaoWiFi();
  
  // Envia ping periódico
  enviarPing();
  
  // Log periódico
  if (millis() - ultimoLogSistema > INTERVALO_LOG_SISTEMA) {
    logSistema();
    ultimoLogSistema = millis();
  }
  
  // Reset watchdog
  esp_task_wdt_reset();
  
  // LED indica status
  if (sistemaOnline) {
    digitalWrite(LED_BUILTIN, millis() % 2000 < 1000); // Piscando lento
  } else {
    digitalWrite(LED_BUILTIN, millis() % 500 < 250); // Piscando rápido
  }
  
  server.handleClient();
  delay(10);
}
