#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "mbedtls/sha256.h"
#include <esp_task_wdt.h>

/* =====================================================
   ESP32 COM mDNS - ACESSO POR NOME
   ===================================================== */

// Token SHA256
#define AIRE_ESP_SECRET "AIRE_2025_SUPER_SECRETO"
#define WIFI_RESET_TOKEN "8433135"
#define MAX_TENTATIVAS_WIFI 3
#define TIMEOUT_WIFI 10000
#define INTERVALO_VERIFICACAO_WIFI 30000

// WiFi
const char* WIFI_SSID = "NEW LINK - CAMILLA 2G";
const char* WIFI_PASSWORD = "NG147068";

/* =====================================================
   CONFIGURAÇÕES
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
Preferences prefs;

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

// Identificação do dispositivo
String deviceId = "";
String deviceName = "";
String mdnsName = "";
String currentIP = "";

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
   CONEXÃO WiFi COM mDNS
   ===================================================== */
bool conectarWiFi() {
  Serial.println("[AIRE] Conectando ao WiFi...");
  Serial.println("[AIRE] SSID: " + String(WIFI_SSID));

  // Gera nome único para mDNS
  deviceId = gerarDeviceId();
  deviceName = "AIRE-ESP32-" + deviceId;
  mdnsName = "aire32-" + deviceId.toLowerCase();
  
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(deviceName.c_str());
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    currentIP = WiFi.localIP().toString();
    Serial.println("\n[AIRE] ✅ WiFi conectado!");
    Serial.print("[AIRE] IP: ");
    Serial.println(currentIP);
    Serial.print("[AIRE] Device Name: ");
    Serial.println(deviceName);
    Serial.print("[AIRE] mDNS: ");
    Serial.println(mdnsName + ".local");
    Serial.print("[AIRE] RSSI: ");
    Serial.println(WiFi.RSSI());
    
    // Inicia mDNS
    if (MDNS.begin(mdnsName.c_str())) {
      Serial.println("[AIRE] ✅ mDNS iniciado");
      
      // Adiciona serviços mDNS
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("aire", "tcp", 80);
      MDNS.addServiceTxt("aire", "tcp", "device", deviceName);
      MDNS.addServiceTxt("aire", "tcp", "id", deviceId);
      MDNS.addServiceTxt("aire", "tcp", "type", "gaveteiro");
      
      Serial.println("[AIRE] 📡 Serviços mDNS registrados");
    } else {
      Serial.println("[AIRE] ❌ Erro ao iniciar mDNS");
    }
    
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
   FUNÇÕES DE PORTA (mesmas do original)
   ===================================================== */

void abrirPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  // Simulação - substituir pelo controle real do MCP23017
  Serial.printf("[AIRE] Porta %d ABERTA (simulação)\n", porta);
  portaAberta[i] = true;
  pulsoAtivo[i] = true;
  tempoInicioPulso[i] = millis();
}

void fecharPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  // Simulação - substituir pelo controle real do MCP23017
  Serial.printf("[AIRE] Porta %d FECHADA (simulação)\n", porta);
  portaAberta[i] = false;
  pulsoAtivo[i] = false;
}

void verificarPulsos() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i] && agora - tempoInicioPulso[i] >= TEMPO_PULSO) {
      portaAberta[i] = false;
      pulsoAtivo[i] = false;
      Serial.printf("[AIRE] Porta %d FECHADA (pulso de %dms)\n", i + 1, TEMPO_PULSO);
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

/* =====================================================
   ROTAS COM mDNS
   ===================================================== */

void handleDiscovery() {
  String json = "{"
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"ip\":\"" + currentIP + "\","
    "\"mdns\":\"" + mdnsName + ".local\","
    "\"hostname\":\"" + deviceName + "\","
    "\"status\":\"online\","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"acessos\":{"
      "\"ip\":\"http://" + currentIP + "\","
      "\"mdns\":\"http://" + mdnsName + ".local\","
      "\"nome\":\"" + deviceName + "\""
    "},"
    "\"timestamp\":" + String(millis()) +
    "}";
  
  server.send(200, "application/json", json);
}

void handleStatus() {
  String json = "{"
    "\"device\":\"" + deviceName + "\","
    "\"id\":\"" + deviceId + "\","
    "\"ip\":\"" + currentIP + "\","
    "\"mdns\":\"" + mdnsName + ".local\","
    "\"hostname\":\"" + deviceName + "\","
    "\"ssid\":\"" + WiFi.SSID() + "\","
    "\"rssi\":" + String(WiFi.RSSI()) + ","
    "\"uptime\":" + String(millis() / 1000) + ","
    "\"memoria_livre\":" + String(ESP.getFreeHeap()) + ","
    "\"acessos\":{"
      "\"ip\":\"http://" + currentIP + "\","
      "\"mdns\":\"http://" + mdnsName + ".local\","
      "\"nome\":\"" + deviceName + "\""
    "},"
    "\"portas\":[";
    
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (i > 0) json += ",";
    json += "{\"porta\":" + String(i + 1) + 
           ",\"estado\":\"" + String(portaAberta[i] ? "aberta" : "fechada") + 
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

void handleIdentify() {
  Serial.println("[AIRE] 🔍 REQUISIÇÃO DE IDENTIFICAÇÃO RECEBIDA");
  
  // Pisca LED builtin para identificação física
  for(int i = 0; i < 5; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(200);
    digitalWrite(LED_BUILTIN, LOW);
    delay(200);
  }
  
  String response = "{"
    "\"ok\":true,"
    "\"message\":\"Device identificado: " + deviceName + "\","
    "\"led_blink\":true,"
    "\"acessos\":{"
      "\"ip\":\"http://" + currentIP + "\","
      "\"mdns\":\"http://" + mdnsName + ".local\","
      "\"nome\":\"" + deviceName + "\""
    "}"
  "}";
  server.send(200, "application/json", response);
}

/* =====================================================
   LOG DO SISTEMA
   ===================================================== */
void logSistema() {
  Serial.println("[AIRE] === STATUS DO SISTEMA mDNS ===");
  Serial.println("[AIRE] Device: " + deviceName);
  Serial.println("[AIRE] ID: " + deviceId);
  Serial.println("[AIRE] mDNS: " + mdnsName + ".local");
  Serial.println("[AIRE] IP: " + currentIP);
  Serial.println("[AIRE] SSID: " + WiFi.SSID());
  Serial.println("[AIRE] RSSI: " + String(WiFi.RSSI()) + " dBm");
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

  Serial.println("\n=== AIRE ESP32 COM mDNS ===");
  
  // Inicializa watchdog
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = 5000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("[AIRE] Watchdog configurado");

  // Conecta WiFi com mDNS
  if(!conectarWiFi()) {
    Serial.println("[AIRE] ❌ Falha na conexão WiFi, reiniciando...");
    delay(5000);
    ESP.restart();
  }

  // Configura servidor web
  server.on("/discovery", handleDiscovery);
  server.on("/status", handleStatus);
  server.on("/abrir", handleAbrir);
  server.on("/identify", handleIdentify);
  
  // Adiciona CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  server.begin();
  Serial.println("[AIRE] Servidor HTTP iniciado na porta 80");
  
  // Log inicial
  logSistema();
  
  Serial.println("[AIRE] ✅ Sistema mDNS pronto!");
  Serial.println("[AIRE] Acesse por:");
  Serial.println("[AIRE]   IP: http://" + currentIP);
  Serial.println("[AIRE]   Nome: http://" + mdnsName + ".local");
}

/* =====================================================
   LOOP
   ===================================================== */
void loop() {
  verificarPulsos();
  verificarConexaoWiFi();
  
  // Atualiza mDNS
  MDNS.update();
  
  // Reset watchdog
  esp_task_wdt_reset();
  
  // LED indica status
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_BUILTIN, millis() % 2000 < 1000); // Piscando lento
  } else {
    digitalWrite(LED_BUILTIN, millis() % 500 < 250); // Piscando rápido
  }
  
  server.handleClient();
  delay(10);
}
