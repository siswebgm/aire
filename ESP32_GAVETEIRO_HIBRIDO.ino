#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <Ethernet.h>

/* =====================================================
   CONFIGURAÇÕES GERAIS
   ===================================================== */

// WiFi (fallback)
const char* WIFI_SSID = "NEW LINK - CAMILLA 2G";
const char* WIFI_PASSWORD = "NG147068";

// Token
const char* BEARER_TOKEN = "Bearer teste";

// Ethernet W5500
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
IPAddress ip_ethernet(192,168,1,100);
IPAddress gateway(192,168,1,1);
IPAddress subnet(255,255,255,0);
IPAddress dns(8,8,8,8);

#define ETH_CS_PIN  15   // ⚠️ usado apenas para SPI
#define ETH_RST_PIN -1

/* =====================================================
   PORTAS
   ===================================================== */

#define NUM_PORTAS 10   // seguro com Ethernet

// GPIOs 100% SEGUROS (sem boot strap)
const int RELE_PINS[NUM_PORTAS] = {
  26,  // Porta 1
  27,  // Porta 2
  16,  // Porta 3
  17,  // Porta 4
  21,  // Porta 5
  22,  // Porta 6
  23,  // Porta 7
  25,  // Porta 8
  32,  // Porta 9
  33   // Porta 10
};

const int SENSOR_PINS[NUM_PORTAS] = {
  34, 35, 36, 39,   // input only
  -1, -1, -1, -1,
  -1, -1
};

#define TEMPO_PULSO 400

/* =====================================================
   RELÉ – SOLUÇÃO DEFINITIVA
   ===================================================== */
// 🔒 RELÉ ATIVO EM LOW (padrão profissional)
const bool RELE_ATIVO_EM_HIGH = false;

const uint8_t RELE_LIGADO    = RELE_ATIVO_EM_HIGH ? HIGH : LOW;
const uint8_t RELE_DESLIGADO = RELE_ATIVO_EM_HIGH ? LOW  : HIGH;

/* =====================================================
   VARIÁVEIS
   ===================================================== */

WebServer server(80);
EthernetServer ethServer(80);

enum ConexaoTipo { NENHUMA, ETHERNET, WIFI };
ConexaoTipo conexaoAtiva = NENHUMA;

bool portaAberta[NUM_PORTAS] = {false};
bool pulsoAtivo[NUM_PORTAS]  = {false};
unsigned long tempoInicioPulso[NUM_PORTAS] = {0};

bool sensorFechado[NUM_PORTAS] = {false};
bool sensorEstadoAnterior[NUM_PORTAS] = {false};
unsigned long sensorUltimoDebounce[NUM_PORTAS] = {0};

#define SENSOR_DEBOUNCE_MS 300

/* =====================================================
   FUNÇÕES DE PORTA
   ===================================================== */

void abrirPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;
  if (RELE_PINS[i] < 0) return;
  digitalWrite(RELE_PINS[i], RELE_LIGADO);
  portaAberta[i] = true;
  pulsoAtivo[i] = true;
  tempoInicioPulso[i] = millis();
}

void fecharPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;
  if (RELE_PINS[i] < 0) return;
  digitalWrite(RELE_PINS[i], RELE_DESLIGADO);
  portaAberta[i] = false;
  pulsoAtivo[i] = false;
}

void verificarPulsos() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i] && (agora - tempoInicioPulso[i] >= TEMPO_PULSO)) {
      if (RELE_PINS[i] >= 0) {
        digitalWrite(RELE_PINS[i], RELE_DESLIGADO);
      }
      pulsoAtivo[i] = false;
      portaAberta[i] = false;
    }
  }
}

/* =====================================================
   SENSORES
   ===================================================== */

bool lerSensor(int gpio) {
  return digitalRead(gpio) == LOW;
}

void atualizarSensores() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (SENSOR_PINS[i] < 0) continue;
    bool leitura = lerSensor(SENSOR_PINS[i]);
    if (leitura != sensorEstadoAnterior[i] &&
        agora - sensorUltimoDebounce[i] > SENSOR_DEBOUNCE_MS) {
      sensorEstadoAnterior[i] = leitura;
      sensorFechado[i] = leitura;
      sensorUltimoDebounce[i] = agora;
      Serial.print("[SENSOR] Porta ");
      Serial.print(i + 1);
      Serial.print(" GPIO ");
      Serial.print(SENSOR_PINS[i]);
      Serial.print(" => ");
      Serial.println(leitura ? "FECHADO" : "ABERTO");
    }
  }
}

/* =====================================================
   AUTENTICAÇÃO
   ===================================================== */

bool auth() {
  if (!server.hasHeader("Authorization")) return false;
  return server.header("Authorization") == BEARER_TOKEN;
}

/* =====================================================
   ROTAS
   ===================================================== */

void handleStatus() {
  if (!auth()) return server.send(401,"application/json","{}");
  String json="{\"portas\":[";
  for(int i=0;i<NUM_PORTAS;i++){
    if(i) json+=",";
    json+="{\"porta\":"+String(i+1)+",\"estado\":\""+String(portaAberta[i]?"aberta":"fechada")+"\",\"sensor\":\"";
    if (SENSOR_PINS[i] < 0) {
      json+="indefinido\"}";
    } else {
      json+=String(sensorFechado[i] ? "fechado" : "aberto");
      json+="\"}";
    }
  }
  json+="]}";
  server.send(200,"application/json",json);
}

void handleAbrir() {
  if (!auth()) return server.send(401,"application/json","{}");
  int p = server.arg("porta").toInt();
  abrirPorta(p);
  server.send(200,"application/json","{\"ok\":true}");
}

void handleFechar() {
  if (!auth()) return server.send(401,"application/json","{}");
  int p = server.arg("porta").toInt();
  fecharPorta(p);
  server.send(200,"application/json","{\"ok\":true}");
}

/* =====================================================
   CONEXÕES
   ===================================================== */

bool conectarEthernet() {
  SPI.begin();
  Ethernet.init(ETH_CS_PIN);
  Ethernet.begin(mac, ip_ethernet, dns, gateway, subnet);
  delay(1000);
  if (Ethernet.linkStatus() == LinkON) {
    conexaoAtiva = ETHERNET;
    return true;
  }
  return false;
}

bool conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for(int i=0;i<20;i++){
    if(WiFi.status()==WL_CONNECTED){
      conexaoAtiva=WIFI;
      return true;
    }
    delay(500);
  }
  return false;
}

/* =====================================================
   SETUP – BLINDADO CONTRA BOOT
   ===================================================== */

void setup() {
  // 🔒 RELÉS DESLIGADOS ANTES DE QUALQUER COISA
  for(int i=0;i<NUM_PORTAS;i++){
    if (RELE_PINS[i] < 0) continue;
    digitalWrite(RELE_PINS[i], RELE_DESLIGADO);
    pinMode(RELE_PINS[i], OUTPUT);
    digitalWrite(RELE_PINS[i], RELE_DESLIGADO);
  }

  Serial.begin(115200);
  delay(300);

  for(int i=0;i<NUM_PORTAS;i++){
    if(SENSOR_PINS[i]>=34 && SENSOR_PINS[i]<=39)
      pinMode(SENSOR_PINS[i], INPUT);
    else if(SENSOR_PINS[i]>=0)
      pinMode(SENSOR_PINS[i], INPUT_PULLUP);
  }

  if(!conectarEthernet())
    if(!conectarWiFi())
      ESP.restart();

  server.on("/status", handleStatus);
  server.on("/abrir", handleAbrir);
  server.on("/fechar", handleFechar);
  server.begin();
}

/* =====================================================
   LOOP
   ===================================================== */

void loop() {
  verificarPulsos();
  atualizarSensores();
  server.handleClient();
  delay(10);
}
