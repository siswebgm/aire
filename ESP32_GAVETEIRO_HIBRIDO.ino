#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <Ethernet.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>

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

/* =====================================================
   FUNÇÕES DE PORTA
   ===================================================== */

void abrirPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  mcp.digitalWrite(8 + i, RELE_LIGADO); // GPB
  portaAberta[i] = true;
  pulsoAtivo[i] = true;
  tempoInicioPulso[i] = millis();
}

void fecharPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  mcp.digitalWrite(8 + i, RELE_DESLIGADO);
  portaAberta[i] = false;
  pulsoAtivo[i] = false;
}

void verificarPulsos() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i] && agora - tempoInicioPulso[i] >= TEMPO_PULSO) {
      mcp.digitalWrite(8 + i, RELE_DESLIGADO);
      pulsoAtivo[i] = false;
      portaAberta[i] = false;
    }
  }
}

/* =====================================================
   SENSORES (MCP)
   ===================================================== */

void atualizarSensores() {
  unsigned long agora = millis();
  for (int i = 0; i < NUM_PORTAS; i++) {
    bool leitura = (mcp.digitalRead(i) == LOW); // GPA

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
    json+="{\"porta\":"+String(i+1)+
          ",\"estado\":\""+String(portaAberta[i]?"aberta":"fechada")+
          "\",\"sensor\":\""+String(sensorFechado[i]?"fechado":"aberto")+"\"}";
  }
  json+="]}";

  server.send(200,"application/json",json);
}

void handleAbrir() {
  if (!auth()) return server.send(401,"application/json","{}");
  abrirPorta(server.arg("porta").toInt());
  server.send(200,"application/json","{\"ok\":true}");
}

void handleFechar() {
  if (!auth()) return server.send(401,"application/json","{}");
  fecharPorta(server.arg("porta").toInt());
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
   SETUP
   ===================================================== */

void setup() {
  Serial.begin(115200);
  delay(300);

  // I2C
  Wire.begin(21,22);

  // MCP
  mcp.begin_I2C(0x20);

  for(int i=0;i<NUM_PORTAS;i++){
    mcp.pinMode(i, INPUT_PULLUP);   // GPA sensores
    mcp.pinMode(8+i, OUTPUT);       // GPB relés
    mcp.digitalWrite(8+i, RELE_DESLIGADO);
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
