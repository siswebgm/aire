#include <WiFi.h>
#include <WebServer.h>

// ============================================
// CONFIGURACOES - EDITE AQUI
// ============================================

// WiFi
const char* WIFI_SSID = "SUA_REDE_WIFI";        // Nome da sua rede WiFi
const char* WIFI_PASSWORD = "SUA_SENHA_WIFI";  // Senha da sua rede WiFi

// Token de autenticacao (mesmo do .env)
const char* BEARER_TOKEN = "Bearer teste";

// ============================================
// CONFIGURACAO DE PORTAS (RELES E SENSORES)
// ============================================
// Cada porta tem:
//   - 1 rele para acionar a fechadura
//   - 1 sensor magnetico para detectar se esta fechada
// Ajuste conforme sua instalacao fisica
// 
// ARQUITETURA: 8 Gaveteiros x 12 portas = 96 portas total
// Cada ESP32 controla 1 gaveteiro com ate 12 portas

#define NUM_PORTAS 12  // Numero total de portas por gaveteiro

// ============================================
// MAPEAMENTO DE CONEXÕES - 12 FECHADURAS + 8 SENSORES
// ============================================
// ⚠️ GPIOs EVITADOS (pulsam no boot): 2, 12, 15
//
// ┌────────┬─────────────────────┬─────────────────────┐
// │ PORTA  │ FECHADURA (Relé)    │ SENSOR (Magnético)  │
// ├────────┼─────────────────────┼─────────────────────┤
// │   1    │ GPIO 25             │ GPIO 34             │
// │   2    │ GPIO 26             │ GPIO 35             │
// │   3    │ GPIO 27             │ GPIO 32             │
// │   4    │ GPIO 14             │ GPIO 33             │
// │   5    │ GPIO 13             │ GPIO 36             │
// │   6    │ GPIO 4              │ GPIO 39             │
// │   7    │ GPIO 5              │ GPIO 16             │
// │   8    │ GPIO 18             │ GPIO 17             │
// │   9    │ GPIO 19             │ SEM SENSOR          │
// │  10    │ GPIO 23             │ SEM SENSOR          │
// │  11    │ GPIO 21             │ SEM SENSOR          │
// │  12    │ GPIO 22             │ SEM SENSOR          │
// └────────┴─────────────────────┴─────────────────────┘

const int RELE_PINS[NUM_PORTAS] = {
  25,  // Porta 1  -> GPIO 25 (fechadura)
  26,  // Porta 2  -> GPIO 26 (fechadura)
  27,  // Porta 3  -> GPIO 27 (fechadura)
  14,  // Porta 4  -> GPIO 14 (fechadura)
  13,  // Porta 5  -> GPIO 13 (fechadura)
  4,   // Porta 6  -> GPIO 4  (fechadura)
  5,   // Porta 7  -> GPIO 5  (fechadura)
  18,  // Porta 8  -> GPIO 18 (fechadura)
  19,  // Porta 9  -> GPIO 19 (fechadura)
  23,  // Porta 10 -> GPIO 23 (fechadura)
  21,  // Porta 11 -> GPIO 21 (fechadura)
  22   // Porta 12 -> GPIO 22 (fechadura)
};

const int SENSOR_PINS[NUM_PORTAS] = {
  34,  // Porta 1  -> GPIO 34 (sensor)
  35,  // Porta 2  -> GPIO 35 (sensor)
  32,  // Porta 3  -> GPIO 32 (sensor)
  33,  // Porta 4  -> GPIO 33 (sensor)
  36,  // Porta 5  -> GPIO 36 (sensor)
  39,  // Porta 6  -> GPIO 39 (sensor)
  16,  // Porta 7  -> GPIO 16 (sensor)
  17,  // Porta 8  -> GPIO 17 (sensor)
  -1,  // Porta 9  -> SEM SENSOR (GPIO usado na fechadura)
  -1,  // Porta 10 -> SEM SENSOR (GPIO usado na fechadura)
  -1,  // Porta 11 -> SEM SENSOR (GPIO usado na fechadura)
  -1   // Porta 12 -> SEM SENSOR (GPIO usado na fechadura)
};

// Tempo que o rele fica acionado para abrir (ms)
// IMPORTANTE: Fechaduras NAO devem ficar energizadas continuamente!
// Use um pulso curto (2-5 segundos) para evitar superaquecimento
#define TEMPO_PULSO 1000  // 1 segundo de pulso

// ============================================
// VARIAVEIS GLOBAIS
// ============================================

WebServer server(80);

// Estado de cada porta (true = destrancada, false = trancada)
bool portaAberta[NUM_PORTAS] = {false};

// Estado do sensor de cada porta (true = porta fisica fechada)
bool sensorFechado[NUM_PORTAS] = {false};

// Controle de tempo para PULSO (desligar rele automaticamente)
unsigned long tempoInicioPulso[NUM_PORTAS] = {0};
bool pulsoAtivo[NUM_PORTAS] = {false};

// Reconexao WiFi
unsigned long ultimaVerificacaoWifi = 0;
const unsigned long INTERVALO_VERIFICACAO_WIFI = 10000;

// ============================================
// FUNCOES AUXILIARES
// ============================================

bool validarToken() {
  if (!server.hasHeader("Authorization")) {
    Serial.println("[AUTH] Header Authorization nao encontrado");
    return false;
  }
  
  String authHeader = server.header("Authorization");
  bool valido = (authHeader == String(BEARER_TOKEN));
  
  if (!valido) {
    Serial.println("[AUTH] Token invalido: " + authHeader);
  }
  
  return valido;
}

// Abre uma porta especifica com PULSO
// O rele liga por TEMPO_PULSO ms e depois desliga automaticamente
void abrirPorta(int numeroPorta) {
  if (numeroPorta < 1 || numeroPorta > NUM_PORTAS) {
    Serial.println("[ERRO] Numero de porta invalido: " + String(numeroPorta));
    return;
  }
  
  int indice = numeroPorta - 1;
  int gpio = RELE_PINS[indice];
  
  Serial.println("[PORTA " + String(numeroPorta) + "] PULSO iniciado (GPIO " + String(gpio) + ") - " + String(TEMPO_PULSO) + "ms");
  
  // Acionar rele com PULSO (HIGH = acionado)
  digitalWrite(gpio, HIGH);
  portaAberta[indice] = true;
  
  // Marcar tempo para desligar automaticamente
  tempoInicioPulso[indice] = millis();
  pulsoAtivo[indice] = true;
}

// Fecha uma porta especifica (desliga o rele imediatamente)
void fecharPorta(int numeroPorta) {
  if (numeroPorta < 1 || numeroPorta > NUM_PORTAS) {
    Serial.println("[ERRO] Numero de porta invalido: " + String(numeroPorta));
    return;
  }
  
  int indice = numeroPorta - 1;
  int gpio = RELE_PINS[indice];
  
  Serial.println("[PORTA " + String(numeroPorta) + "] Fechando (GPIO " + String(gpio) + ")");
  
  // Desacionar rele (LOW = desacionado)
  digitalWrite(gpio, LOW);
  portaAberta[indice] = false;
  pulsoAtivo[indice] = false; // Cancelar pulso se estiver ativo
}

// Verifica e DESLIGA reles que passaram do tempo do PULSO
// IMPORTANTE: Isso evita que a fechadura fique energizada e esquente!
void verificarPulsos() {
  unsigned long agora = millis();
  
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i]) {
      if (agora - tempoInicioPulso[i] >= TEMPO_PULSO) {
        // Desligar rele automaticamente (LOW = desligado)
        digitalWrite(RELE_PINS[i], LOW);
        portaAberta[i] = false;
        pulsoAtivo[i] = false;
        Serial.println("[PORTA " + String(i + 1) + "] PULSO finalizado - rele desligado");
      }
    }
  }
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
  Serial.println("[OPTIONS] Requisicao CORS preflight");
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

// GET /abrir?porta=1  ou  GET /abrir/1
void handleAbrir() {
  Serial.println("[GET] /abrir");
  
  // Obter numero da porta do parametro ?porta=X
  int numeroPorta = 1; // Default porta 1
  
  if (server.hasArg("porta")) {
    numeroPorta = server.arg("porta").toInt();
  }
  
  // Validar numero da porta
  if (numeroPorta < 1 || numeroPorta > NUM_PORTAS) {
    char erro[100];
    snprintf(erro, sizeof(erro), 
      "{\"error\":\"Porta invalida. Use 1 a %d\"}", NUM_PORTAS);
    enviarResposta(400, "application/json", erro);
    return;
  }
  
  // Abrir a porta especifica
  abrirPorta(numeroPorta);
  
  char resposta[150];
  snprintf(resposta, sizeof(resposta), 
    "{\"porta\":%d,\"status\":\"aberta\",\"gpio\":%d}",
    numeroPorta, RELE_PINS[numeroPorta - 1]);
  
  enviarResposta(200, "application/json", resposta);
}

// GET /fechar?porta=1
void handleFechar() {
  Serial.println("[GET] /fechar");
  
  int numeroPorta = 1;
  
  if (server.hasArg("porta")) {
    numeroPorta = server.arg("porta").toInt();
  }
  
  if (numeroPorta < 1 || numeroPorta > NUM_PORTAS) {
    char erro[100];
    snprintf(erro, sizeof(erro), 
      "{\"error\":\"Porta invalida. Use 1 a %d\"}", NUM_PORTAS);
    enviarResposta(400, "application/json", erro);
    return;
  }
  
  fecharPorta(numeroPorta);
  
  char resposta[150];
  snprintf(resposta, sizeof(resposta), 
    "{\"porta\":%d,\"status\":\"fechada\",\"gpio\":%d}",
    numeroPorta, RELE_PINS[numeroPorta - 1]);
  
  enviarResposta(200, "application/json", resposta);
}

// Ler um sensor com DEBOUNCE FORTE (multiplas leituras para estabilizar)
// GPIOs 34-39 nao tem pull-up interno e FLUTUAM MUITO
bool lerSensorComDebounce(int gpio) {
  if (gpio < 0) return false;
  
  int leituras_low = 0;
  const int TOTAL_LEITURAS = 20;  // Aumentado de 5 para 20
  const int DELAY_MS = 5;          // Aumentado de 2 para 5ms
  
  // Fazer multiplas leituras espalhadas no tempo
  for (int i = 0; i < TOTAL_LEITURAS; i++) {
    if (digitalRead(gpio) == LOW) {
      leituras_low++;
    }
    delay(DELAY_MS);
  }
  
  // Considera fechado se 80% das leituras for LOW (mais rigoroso)
  // (16 de 20 = 80% das leituras)
  return (leituras_low >= 16);
}

// Estado anterior do sensor (para evitar mudancas rapidas)
bool sensorEstadoAnterior[NUM_PORTAS] = {false};
unsigned long sensorUltimoDebounce[NUM_PORTAS] = {0};
const unsigned long SENSOR_DEBOUNCE_MS = 500; // Minimo 500ms entre mudancas

// Ler sensor com HISTERESE (evita flip-flop)
bool lerSensorComHisterese(int indice) {
  int gpio = SENSOR_PINS[indice];
  if (gpio < 0) return false;
  
  bool leituraAtual = lerSensorComDebounce(gpio);
  unsigned long agora = millis();
  
  // Se mudou de estado, verificar se passou tempo suficiente
  if (leituraAtual != sensorEstadoAnterior[indice]) {
    if (agora - sensorUltimoDebounce[indice] >= SENSOR_DEBOUNCE_MS) {
      // Mudanca valida - atualizar estado
      sensorEstadoAnterior[indice] = leituraAtual;
      sensorUltimoDebounce[indice] = agora;
      return leituraAtual;
    } else {
      // Mudanca muito rapida - manter estado anterior
      return sensorEstadoAnterior[indice];
    }
  }
  
  return leituraAtual;
}

// Ler todos os sensores magneticos
void lerSensores() {
  for (int i = 0; i < NUM_PORTAS; i++) {
    // Pular sensores nao configurados (-1)
    if (SENSOR_PINS[i] < 0) {
      sensorFechado[i] = false; // Assume aberto se nao tem sensor
      continue;
    }
    // Usar leitura com HISTERESE para estabilizar (evita flip-flop)
    sensorFechado[i] = lerSensorComHisterese(i);
  }
}

// GET /status ou GET /status?porta=1
void handleStatus() {
  Serial.println("[GET] /status");
  
  // Ler todos os sensores magneticos
  lerSensores();
  
  // Se especificou uma porta, retorna status dela
  if (server.hasArg("porta")) {
    int numeroPorta = server.arg("porta").toInt();
    
    if (numeroPorta < 1 || numeroPorta > NUM_PORTAS) {
      enviarResposta(400, "application/json", "{\"error\":\"Porta invalida\"}");
      return;
    }
    
    int indice = numeroPorta - 1;
    char resposta[300];
    snprintf(resposta, sizeof(resposta), 
      "{\"porta\":%d,\"fechadura\":\"%s\",\"sensor\":\"%s\",\"porta_fisica\":\"%s\",\"gpio_rele\":%d,\"gpio_sensor\":%d}",
      numeroPorta,
      portaAberta[indice] ? "aberta" : "fechada",
      sensorFechado[indice] ? "fechado" : "aberto",
      sensorFechado[indice] ? "fechada" : "aberta",
      RELE_PINS[indice],
      SENSOR_PINS[indice]);
    
    enviarResposta(200, "application/json", resposta);
    return;
  }
  
  // Retorna status geral de todas as portas
  String json = "{\"portas\":[";
  
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (i > 0) json += ",";
    json += "{\"numero\":" + String(i + 1);
    json += ",\"fechadura\":\"" + String(portaAberta[i] ? "aberta" : "fechada") + "\"";
    json += ",\"sensor\":\"" + String(sensorFechado[i] ? "fechado" : "aberto") + "\"";
    json += ",\"porta_fisica\":\"" + String(sensorFechado[i] ? "fechada" : "aberta") + "\"";
    json += ",\"gpio_rele\":" + String(RELE_PINS[i]);
    json += ",\"gpio_sensor\":" + String(SENSOR_PINS[i]) + "}";
  }
  
  json += "],\"uptime\":" + String(millis() / 1000);
  json += ",\"wifi_rssi\":" + String(WiFi.RSSI()) + "}";
  
  enviarResposta(200, "application/json", json.c_str());
}

// GET /sensor ou GET /sensor?gpio=34
// Endpoint para testar sensores diretamente
void handleSensor() {
  Serial.println("[GET] /sensor");
  
  // Se especificou um GPIO, le diretamente
  if (server.hasArg("gpio")) {
    int gpio = server.arg("gpio").toInt();
    
    // Verificar se e um GPIO valido para entrada
    if (gpio < 0 || gpio > 39) {
      enviarResposta(400, "application/json", "{\"error\":\"GPIO invalido. Use 0-39\"}");
      return;
    }
    
    // Configurar como entrada (sem pullup para GPIOs 34-39)
    if (gpio >= 34 && gpio <= 39) {
      pinMode(gpio, INPUT);
    } else {
      pinMode(gpio, INPUT_PULLUP);
    }
    
    // Ler valor COM DEBOUNCE (multiplas leituras para estabilizar)
    int leituras_low = 0;
    const int TOTAL_LEITURAS = 10;
    for (int i = 0; i < TOTAL_LEITURAS; i++) {
      if (digitalRead(gpio) == LOW) leituras_low++;
      delay(2);
    }
    
    // Considera LOW se maioria das leituras for LOW
    bool sensor_ativado = (leituras_low >= 6);
    int valor = sensor_ativado ? 0 : 1;
    
    char resposta[250];
    snprintf(resposta, sizeof(resposta), 
      "{\"gpio\":%d,\"valor\":%d,\"estado\":\"%s\",\"interpretacao\":\"%s\",\"leituras_low\":%d,\"total\":%d}",
      gpio,
      valor,
      valor == LOW ? "LOW" : "HIGH",
      valor == LOW ? "Sensor ativado (ima encostado)" : "Sensor desativado (ima afastado)",
      leituras_low,
      TOTAL_LEITURAS);
    
    Serial.println("[SENSOR] GPIO " + String(gpio) + " = " + String(leituras_low) + "/" + String(TOTAL_LEITURAS) + " LOW");
    enviarResposta(200, "application/json", resposta);
    return;
  }
  
  // Se nao especificou GPIO, mostra todos os sensores configurados
  lerSensores();
  
  String json = "{\"sensores\":[";
  
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (i > 0) json += ",";
    
    int gpio = SENSOR_PINS[i];
    int valor = (gpio >= 0) ? digitalRead(gpio) : -1;
    
    json += "{\"porta\":" + String(i + 1);
    json += ",\"gpio\":" + String(gpio);
    json += ",\"valor\":" + String(valor);
    json += ",\"estado\":\"" + String(gpio < 0 ? "N/A" : (sensorFechado[i] ? "fechado" : "aberto")) + "\"}";
  }
  
  json += "]}";
  
  enviarResposta(200, "application/json", json.c_str());
}

void handleNotFound() {
  Serial.println("[404] Rota nao encontrada: " + server.uri());
  enviarResposta(404, "application/json", "{\"error\":\"Rota nao encontrada\"}");
}

// ============================================
// SETUP
// ============================================

void setup() {
  // CRITICO: Configurar reles IMEDIATAMENTE como LOW (desligado)
  // Módulo relé ATIVO EM HIGH - LOW = desligado, HIGH = ligado
  for (int i = 0; i < NUM_PORTAS; i++) {
    pinMode(RELE_PINS[i], OUTPUT);
    digitalWrite(RELE_PINS[i], LOW);  // LOW = relé desligado (fechadura trancada)
  }
  
  Serial.begin(115200);
  delay(500);
  
  Serial.println("\n\n========================================");
  Serial.println("ESP32 - Sistema de Gaveteiros MULTI-PORTA");
  Serial.println("RELES JA CONFIGURADOS COMO HIGH (DESLIGADOS)");
  Serial.println("========================================\n");
  
  // Configurar variaveis e sensores
  Serial.println("[CONFIG] Configurando " + String(NUM_PORTAS) + " portas:");
  Serial.println("         Porta | Rele (GPIO) | Sensor (GPIO)");
  Serial.println("         ------|-------------|---------------");
  
  for (int i = 0; i < NUM_PORTAS; i++) {
    // Rele ja foi configurado acima, apenas inicializar variaveis
    portaAberta[i] = false;
    pulsoAtivo[i] = false;
    tempoInicioPulso[i] = 0;
    
    // Configurar sensor como entrada (se existir)
    if (SENSOR_PINS[i] >= 0) {
      // GPIOs 34-39 nao suportam pullup interno
      if (SENSOR_PINS[i] >= 34 && SENSOR_PINS[i] <= 39) {
        pinMode(SENSOR_PINS[i], INPUT);
      } else {
        pinMode(SENSOR_PINS[i], INPUT_PULLUP);
      }
    }
    sensorFechado[i] = false;
    
    // Log formatado
    char linha[60];
    if (SENSOR_PINS[i] >= 0) {
      snprintf(linha, sizeof(linha), "           %2d   |     %2d      |      %2d", 
        i + 1, RELE_PINS[i], SENSOR_PINS[i]);
    } else {
      snprintf(linha, sizeof(linha), "           %2d   |     %2d      |     N/A", 
        i + 1, RELE_PINS[i]);
    }
    Serial.println(linha);
  }
  
  // REMOVIDO: Teste de reles (causava abertura indevida ao ligar)
  // Os reles ja foram inicializados como LOW (fechados) acima
  Serial.println("\n[RELES] Inicializados como FECHADOS (nenhum acionamento)");
  
  // Ler estado inicial dos sensores
  Serial.println("\n[SENSORES] Estado inicial:");
  lerSensores();
  for (int i = 0; i < NUM_PORTAS; i++) {
    Serial.println("  Porta " + String(i + 1) + ": " + (sensorFechado[i] ? "FECHADA" : "ABERTA"));
  }
  
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
    Serial.println("\n[WiFi] Conectado!");
    Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
    Serial.println("[WiFi] Gateway: " + WiFi.gatewayIP().toString());
  } else {
    Serial.println("\n[WiFi] Falha ao conectar!");
    Serial.println("[WiFi] Reiniciando em 5 segundos...");
    delay(5000);
    ESP.restart();
  }
  
  // Configurar rotas HTTP
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/health", HTTP_OPTIONS, handleOptions);
  server.on("/abrir", HTTP_GET, handleAbrir);
  server.on("/abrir", HTTP_POST, handleAbrir);
  server.on("/abrir", HTTP_OPTIONS, handleOptions);
  server.on("/fechar", HTTP_GET, handleFechar);
  server.on("/fechar", HTTP_POST, handleFechar);
  server.on("/fechar", HTTP_OPTIONS, handleOptions);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/sensor", HTTP_GET, handleSensor);
  server.on("/sensor", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);
  
  // Coletar headers
  const char* headerKeys[] = {"Authorization"};
  server.collectHeaders(headerKeys, 1);
  
  // Iniciar servidor
  server.begin();
  Serial.println("\n[HTTP] Servidor iniciado na porta 80");
  Serial.println("[HTTP] Endpoints disponiveis:");
  Serial.println("  - GET  /health");
  Serial.println("  - GET  /status");
  Serial.println("  - GET  /status?porta=N");
  Serial.println("  - GET  /abrir?porta=N");
  Serial.println("  - GET  /fechar?porta=N");
  Serial.println("  - GET  /sensor");
  Serial.println("  - GET  /sensor?gpio=34");
  
  Serial.println("\n========================================");
  Serial.println("Sistema MULTI-PORTA pronto!");
  Serial.println("Total de portas: " + String(NUM_PORTAS));
  Serial.println("========================================\n");
}

// ============================================
// FUNCAO DE RECONEXAO WIFI
// ============================================

void verificarWifi() {
  if (millis() - ultimaVerificacaoWifi < INTERVALO_VERIFICACAO_WIFI) {
    return; // Ainda nao e hora de verificar
  }
  
  ultimaVerificacaoWifi = millis();
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Conexao perdida! Reconectando...");
    
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int tentativas = 0;
    while (WiFi.status() != WL_CONNECTED && tentativas < 10) {
      delay(500);
      Serial.print(".");
      tentativas++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n[WiFi] Reconectado!");
      Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
    } else {
      Serial.println("\n[WiFi] Falha na reconexao. Tentando novamente em 10s...");
    }
  }
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // Verificar e reconectar WiFi se necessario
  verificarWifi();
  
  // Verificar e desligar reles que passaram do tempo do PULSO
  // IMPORTANTE: Evita superaquecimento da fechadura!
  verificarPulsos();
  
  // Processar requisicoes HTTP (apenas se WiFi conectado)
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }
  
  // Pequeno delay para estabilidade
  delay(10);
}
