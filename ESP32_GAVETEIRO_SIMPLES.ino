#include <WiFi.h>
#include <WebServer.h>
#include <WiFiUdp.h>
#include <Preferences.h>
#include "mbedtls/sha256.h"

/* =====================================================
   CONFIGURAÇÕES
   ===================================================== */

#define AIRE_ESP_SECRET "AIRE_2025_SUPER_SECRETO"
#define TIMEOUT_WIFI 15000
#define NUM_PORTAS 4
#define TEMPO_PULSO 500
const char* FW_VERSION = "AIRE-ESP32-2026-FINAL";

static const char* AP_PASSWORD = "aire8433";
static const char* PORTAL_USER = "aire";
static const char* PORTAL_PASSWORD = "aire8433";

/* =====================================================
   GPIOs
   ===================================================== */

const uint8_t PORTAS_RELE[NUM_PORTAS]   = {26, 27, 21, 22};
const uint8_t PORTAS_SENSOR[NUM_PORTAS] = {18, 19, 23, 4};

const uint8_t RELE_LIGADO    = LOW;
const uint8_t RELE_DESLIGADO = HIGH;

/* =====================================================
   OBJETOS
   ===================================================== */

WebServer server(80);

Preferences prefs;

/* =====================================================
   VARIÁVEIS
   ===================================================== */

bool pulsoAtivo[NUM_PORTAS] = {false};
bool portaAberta[NUM_PORTAS] = {false};
unsigned long tempoPulso[NUM_PORTAS] = {0};

unsigned long tempoLed = 0;
bool estadoLed = false;

unsigned long tempoApCheck = 0;

String deviceId;
String currentIP;

String staIP;
String apIP;

String wifiSsid;
String wifiPassword;

bool modoConfig = false;

static const char* PREF_NS = "aire";
static const char* KEY_SSID = "ssid";
static const char* KEY_PASS = "pass";

/* =====================================================
   DEVICE ID
   ===================================================== */

String gerarDeviceId() {
  uint64_t chipid = ESP.getEfuseMac();
  return String((uint32_t)(chipid >> 32), HEX);
}

void atualizarIP() {
  if (WiFi.status() == WL_CONNECTED) {
    staIP = WiFi.localIP().toString();
  } else {
    staIP = "";
  }

  if (WiFi.getMode() & WIFI_AP) {
    apIP = WiFi.softAPIP().toString();
  } else {
    apIP = "";
  }

  if (staIP.length()) currentIP = staIP;
  else if (apIP.length()) currentIP = apIP;
  else currentIP = "";
}

void ensureAPRunning() {
  String apSsid = "AIRE-" + deviceId;

  if (!modoConfig) {
    return;
  }

  if (!(WiFi.getMode() & WIFI_AP)) {
    WiFi.mode(WIFI_AP_STA);
  }

  IPAddress ip = WiFi.softAPIP();
  bool hasApIp = !(ip[0] == 0 && ip[1] == 0 && ip[2] == 0 && ip[3] == 0);
  if (!hasApIp) {
    WiFi.softAP(apSsid.c_str(), AP_PASSWORD);
    delay(200);
  }
  atualizarIP();
}

void disableAP() {
  if (WiFi.getMode() & WIFI_AP) {
    WiFi.softAPdisconnect(true);
    delay(100);
  }
  if (WiFi.status() == WL_CONNECTED) {
    WiFi.mode(WIFI_STA);
  }
  atualizarIP();
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
   WIFI
   ===================================================== */

bool conectarWiFi() {

  if (!wifiSsid.length()) {
    Serial.println("\n[AIRE] WiFi sem SSID configurado.");
    return false;
  }

  Serial.println("\n[AIRE] Conectando WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());

  unsigned long inicio = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - inicio < TIMEOUT_WIFI) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    atualizarIP();
    Serial.println("\n[AIRE] WiFi conectado!");
    Serial.print("[AIRE] IP: ");
    Serial.println(currentIP);
    modoConfig = false;
    disableAP();
    return true;
  }

  Serial.println("\n[AIRE] Falha no WiFi!");
  return false;
}

void carregarCredenciaisWiFi() {
  prefs.begin(PREF_NS, true);
  wifiSsid = prefs.getString(KEY_SSID, "");
  wifiPassword = prefs.getString(KEY_PASS, "");
  prefs.end();

  if (wifiSsid.length()) {
    Serial.print("[AIRE] SSID salvo: ");
    Serial.println(wifiSsid);
  } else {
    Serial.println("[AIRE] Nenhum SSID salvo.");
  }
}

void salvarCredenciaisWiFi(const String& ssid, const String& pass) {
  prefs.begin(PREF_NS, false);
  prefs.putString(KEY_SSID, ssid);
  prefs.putString(KEY_PASS, pass);
  prefs.end();
}

void limparCredenciaisWiFi() {
  prefs.begin(PREF_NS, false);
  prefs.remove(KEY_SSID);
  prefs.remove(KEY_PASS);
  prefs.end();
}

String htmlEscape(const String& s) {
  String out;
  out.reserve(s.length() + 16);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '&') out += "&amp;";
    else if (c == '<') out += "&lt;";
    else if (c == '>') out += "&gt;";
    else if (c == '"') out += "&quot;";
    else out += c;
  }
  return out;
}

void iniciarModoConfig() {
  modoConfig = true;

  WiFi.scanDelete();
  ensureAPRunning();
  Serial.println("[AIRE] Modo configuração WiFi");
  Serial.print("[AIRE] AP SSID: ");
  Serial.println("AIRE-" + deviceId);
  Serial.print("[AIRE] AP IP: ");
  Serial.println(apIP);
}

String wifiEncToStr(wifi_auth_mode_t enc) {
  switch (enc) {
    case WIFI_AUTH_OPEN:
      return "OPEN";
    case WIFI_AUTH_WEP:
      return "WEP";
    case WIFI_AUTH_WPA_PSK:
      return "WPA";
    case WIFI_AUTH_WPA2_PSK:
      return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK:
      return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE:
      return "WPA2-ENT";
#ifdef WIFI_AUTH_WPA3_PSK
    case WIFI_AUTH_WPA3_PSK:
      return "WPA3";
#endif
#ifdef WIFI_AUTH_WPA2_WPA3_PSK
    case WIFI_AUTH_WPA2_WPA3_PSK:
      return "WPA2/WPA3";
#endif
    default:
      return "?";
  }
}

String jsonEscape(const String& s) {
  String out;
  out.reserve(s.length() + 16);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"') out += "\\\"";
    else if (c == '\\') out += "\\\\";
    else if (c == '\n') out += "\\n";
    else if (c == '\r') out += "\\r";
    else if (c == '\t') out += "\\t";
    else out += c;
  }
  return out;
}

bool requireAuth() {
  if (server.authenticate(PORTAL_USER, PORTAL_PASSWORD)) {
    return true;
  }
  server.requestAuthentication();
  return false;
}

void handleWifiScan() {
  if (!requireAuth()) return;
  int n = WiFi.scanComplete();
  if (n == WIFI_SCAN_RUNNING) {
    server.send(200, "application/json", "{\"status\":\"running\"}");
    return;
  }

  if (n == WIFI_SCAN_FAILED) {
    WiFi.scanNetworks(true);
    server.send(200, "application/json", "{\"status\":\"starting\"}");
    return;
  }

  if (n <= 0) {
    WiFi.scanDelete();
    WiFi.scanNetworks(true);
    server.send(200, "application/json", "{\"status\":\"empty\",\"networks\":[]}");
    return;
  }

  int idx[40];
  int count = n;
  if (count > 40) count = 40;
  for (int i = 0; i < count; i++) idx[i] = i;

  for (int i = 0; i < count - 1; i++) {
    for (int j = i + 1; j < count; j++) {
      if (WiFi.RSSI(idx[j]) > WiFi.RSSI(idx[i])) {
        int tmp = idx[i];
        idx[i] = idx[j];
        idx[j] = tmp;
      }
    }
  }

  String json;
  json.reserve(2048);
  json += "{\"status\":\"ok\",\"networks\":[";
  for (int k = 0; k < count; k++) {
    int i = idx[k];
    String ssid = WiFi.SSID(i);
    int32_t rssi = WiFi.RSSI(i);
    wifi_auth_mode_t enc = WiFi.encryptionType(i);
    bool hidden = ssid.length() == 0;

    if (k) json += ",";
    json += "{";
    json += "\"ssid\":\"" + jsonEscape(ssid) + "\",";
    json += "\"rssi\":" + String(rssi) + ",";
    json += "\"enc\":\"" + wifiEncToStr(enc) + "\",";
    json += "\"hidden\":" + String(hidden ? "true" : "false");
    json += "}";
  }
  json += "]}";
  server.send(200, "application/json", json);
}

void handleWifi() {
  if (!requireAuth()) return;
  String ipStr = staIP.length() ? staIP : String("-");
  String ssidAtual = wifiSsid.length() ? htmlEscape(wifiSsid) : String("");

  String page;
  page.reserve(4096);
  page += "<!doctype html><html><head><meta charset='utf-8'>";
  page += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  page += "<title>AIRE - WiFi</title>";
  page += "<style>";
  page += ":root{--bg1:#070b14;--bg2:#0b1220;--card:rgba(255,255,255,.06);--muted:#9bb0d0;--text:#eaf2ff;--accent:#4ea1ff;--ok:#2dd4bf;--err:#fb7185;--line:rgba(255,255,255,.10);--shadow:0 16px 40px rgba(0,0,0,.28);}";
  page += "*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:linear-gradient(180deg,var(--bg1),var(--bg2) 55%,var(--bg1));color:var(--text)}";
  page += "body:before{content:'';position:fixed;inset:-20%;background:radial-gradient(900px 520px at 20% 0%,rgba(78,161,255,.16),transparent 60%),radial-gradient(760px 420px at 110% 10%,rgba(45,212,191,.12),transparent 55%);pointer-events:none;filter:blur(0px)}";
  page += ".wrap{max-width:860px;margin:0 auto;padding:18px}h1{margin:4px 0 14px;font-size:26px;letter-spacing:.4px}h2{margin:0;font-size:13px;color:rgba(234,242,255,.86);font-weight:900;text-transform:uppercase;letter-spacing:.14em}";
  page += ".grid{display:grid;grid-template-columns:1fr;gap:14px}@media(min-width:820px){.grid{grid-template-columns:1.1fr .9fr}}";
  page += ".card{background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04));border:1px solid var(--line);border-radius:18px;padding:14px;backdrop-filter:blur(10px);box-shadow:var(--shadow)}";
  page += ".cardHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}";
  page += ".cardTitle{display:flex;align-items:center;gap:10px;min-width:0}";
  page += ".iconDot{width:34px;height:34px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;background:rgba(78,161,255,.12);border:1px solid rgba(78,161,255,.20);color:rgba(234,242,255,.92);font-weight:900}";
  page += ".cardBadge{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:12px;color:rgba(234,242,255,.86);font-weight:900;white-space:nowrap}";
  page += ".card.highlight{border-color:rgba(78,161,255,.35);box-shadow:0 18px 46px rgba(78,161,255,.10),var(--shadow)}";
  page += ".card.highlight .iconDot{background:linear-gradient(135deg,rgba(78,161,255,.22),rgba(45,212,191,.16));border-color:rgba(78,161,255,.32)}";
  page += ".meta{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;font-size:13px;color:var(--muted)}.meta b{color:var(--text);font-weight:800}";
  page += ".row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}button{border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:800;cursor:pointer}button:hover{border-color:rgba(78,161,255,.6)}button.primary{background:linear-gradient(90deg,rgba(78,161,255,.95),rgba(78,161,255,.75));border-color:rgba(78,161,255,.75)}button.danger{background:rgba(251,113,133,.12);border-color:rgba(251,113,133,.35)}button:disabled{opacity:.55;cursor:not-allowed}";
  page += ".status{padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-size:13px;color:var(--muted)}.status.ok{border-color:rgba(45,212,191,.55);color:rgba(45,212,191,.95)}.status.err{border-color:rgba(251,113,133,.55);color:rgba(251,113,133,.95)}";
  page += ".status.hint{font-size:12px;line-height:1.35;color:rgba(155,176,208,.85);background:rgba(255,255,255,.03)}";
  page += ".status.result{font-size:12px;color:rgba(234,242,255,.86);background:rgba(255,255,255,.03)}";
  page += "label{display:block;font-size:12px;color:var(--muted);font-weight:800;margin:10px 0 6px}input{width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.18);color:var(--text);outline:none}input:focus{border-color:rgba(78,161,255,.75);box-shadow:0 0 0 3px rgba(78,161,255,.15)}";
  page += ".pill{display:inline-flex;gap:8px;align-items:center;padding:8px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.05);font-size:13px;color:var(--muted)}.pill b{color:var(--text)}";
  page += ".list{margin-top:10px;border:1px solid var(--line);border-radius:14px;overflow:hidden} .item{padding:12px 12px;cursor:pointer;background:rgba(255,255,255,.03)} .item+.item{border-top:1px solid var(--line)} .item:hover{background:rgba(78,161,255,.10)} .item .t{font-weight:900} .item .s{font-size:12px;color:var(--muted);margin-top:2px}";
  page += ".ports{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:520px){.ports{grid-template-columns:repeat(4,1fr)}}";
  page += ".ports button{padding:0;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04));box-shadow:0 10px 24px rgba(0,0,0,.22);overflow:hidden}";
  page += ".ports button:hover{border-color:rgba(78,161,255,.50);transform:translateY(-1px)}";
  page += ".ports button:active{transform:translateY(0px)}";
  page += ".portCard{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:64px;padding:12px}";
  page += ".portLabel{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(155,176,208,.85);font-weight:900}";
  page += ".portNum{font-size:22px;line-height:1;color:rgba(234,242,255,.98);font-weight:950}";
  page += "</style></head><body><div class='wrap'>";
  page += "<h1>AIRE - Configurar WiFi</h1>";
  page += "<div class='grid'>";
  page += "<div class='card'>";
  page += "<div class='cardHead'><div class='cardTitle'><span class='iconDot'>Wi</span><h2>Conexão</h2></div><div class='cardBadge'>WiFi</div></div>";
  page += "<div class='meta'><div>Device</div><div><b>" + htmlEscape(deviceId) + "</b></div><div>FW</div><div><b>" + htmlEscape(String(FW_VERSION)) + "</b></div><div>IP WiFi</div><div><b id='ipSta'>" + htmlEscape(staIP.length() ? staIP : String("-")) + "</b></div><div>IP AP</div><div><b id='ipAp'>" + htmlEscape(apIP.length() ? apIP : String("-")) + "</b></div></div>";
  page += "<div style='margin-top:12px' class='row'>";
  page += "<div class='pill' id='selPill' style='display:none'><span>Selecionado:</span> <b id='selName'></b> <button type='button' onclick='showList()' style='padding:6px 10px;border-radius:999px'>Trocar</button></div>";
  page += "<button type='button' onclick='scan()' id='btnScan'>Buscar / Atualizar WiFi</button>";
  page += "<div id='scanStatus' class='status' style='flex:1;min-width:220px'>Pronto</div>";
  page += "</div>";
  page += "<div id='networks'></div>";
  page += "<label>SSID</label><input id='ssid' value='" + ssidAtual + "' placeholder='Nome do WiFi'>";
  page += "<label>Senha</label><input id='senha' type='password' value='' placeholder='Senha (se houver)'>";
  page += "<div class='row' style='margin-top:12px'>";
  page += "<button class='primary' type='button' onclick='conectar()' id='btnConn'>Conectar</button>";
  page += "<button class='danger' type='button' onclick='desconectar()'>Desconectar</button>";
  page += "<button type='button' onclick='limpar()'>Limpar WiFi salvo</button>";
  page += "</div>";
  page += "</div>";
  page += "<div class='card highlight'>";
  page += "<div class='cardHead'><div class='cardTitle'><span class='iconDot'>TP</span><h2>Testar portas</h2></div><div class='cardBadge'>Teste rápido</div></div>";
  page += "<div class='status hint' id='tipPortal' style='margin-bottom:10px'>Conectado. Você pode testar as portas por aqui.</div>";
  page += "<div class='ports'>";
  page += "<button type='button' onclick='testar(1)'><span class='portCard'><span class='portLabel'>Porta</span><span class='portNum'>1</span></span></button>";
  page += "<button type='button' onclick='testar(2)'><span class='portCard'><span class='portLabel'>Porta</span><span class='portNum'>2</span></span></button>";
  page += "<button type='button' onclick='testar(3)'><span class='portCard'><span class='portLabel'>Porta</span><span class='portNum'>3</span></span></button>";
  page += "<button type='button' onclick='testar(4)'><span class='portCard'><span class='portLabel'>Porta</span><span class='portNum'>4</span></span></button>";
  page += "</div>";
  page += "<div id='portaStatus' class='status result' style='margin-top:10px'>—</div>";
  page += "</div>";
  page += "</div>";
  page += "<script>";
  page += "const elStatus=document.getElementById('scanStatus');";
  page += "const elList=document.getElementById('networks');";
  page += "const ipSta=document.getElementById('ipSta');";
  page += "const ipAp=document.getElementById('ipAp');";
  page += "const selPill=document.getElementById('selPill');";
  page += "const selName=document.getElementById('selName');";
  page += "const portaStatus=document.getElementById('portaStatus');";
  page += "const tipPortal=document.getElementById('tipPortal');";
  page += "function setOk(msg){elStatus.className='status ok';elStatus.textContent=msg;}";
  page += "function setErr(msg){elStatus.className='status err';elStatus.textContent=msg;}";
  page += "function setInfo(msg){elStatus.className='status';elStatus.textContent=msg;}";
  page += "function setSsid(v){document.getElementById('ssid').value=v;}";
  page += "function hideList(){elList.style.display='none';}";
  page += "function showList(){elList.style.display='block';selPill.style.display='none';}";
  page += "function selectWifi(name){setSsid(name);selName.textContent=name||'(oculta)';selPill.style.display='inline-flex';hideList();}";
  page += "function rssiBars(r){if(r>-55)return '★★★★★'; if(r>-65)return '★★★★☆'; if(r>-75)return '★★★☆☆'; if(r>-85)return '★★☆☆☆'; return '★☆☆☆☆';}";
  page += "async function scan(){";
  page += "setInfo('Buscando redes...');";
  page += "elList.style.display='block';";
  page += "elList.innerHTML='';";
  page += "for(let t=0;t<12;t++){";
  page += "const res=await fetch('/wifi/scan',{cache:'no-store'});";
  page += "const data=await res.json();";
  page += "if(data.status==='ok'){";
  page += "setOk('Encontradas: '+data.networks.length);";
  page += "elList.innerHTML='';";
  page += "const box=document.createElement('div');";
  page += "box.className='list';";
  page += "data.networks.forEach((n,i)=>{";
  page += "const row=document.createElement('div');";
  page += "row.className='item';";
  page += "const name=(n.hidden||!n.ssid)?'(oculta)':n.ssid;";
  page += "const t1=document.createElement('div');";
  page += "t1.className='t';";
  page += "t1.textContent=name;";
  page += "const t2=document.createElement('div');";
  page += "t2.className='s';";
  page += "t2.textContent='Sinal: ' + rssiBars(n.rssi) + ' (' + n.rssi + ' dBm) | ' + n.enc;";
  page += "row.appendChild(t1);";
  page += "row.appendChild(t2);";
  page += "row.onclick=()=>selectWifi(n.ssid||'');";
  page += "box.appendChild(row);";
  page += "});";
  page += "elList.appendChild(box);";
  page += "return;";
  page += "} else if(data.status==='running' || data.status==='starting' || data.status==='empty'){";
  page += "await new Promise(r=>setTimeout(r,500));";
  page += "continue;";
  page += "} else {";
  page += "setErr('Falha ao buscar WiFi');";
  page += "return;";
  page += "}";
  page += "}";
  page += "setErr('Tempo esgotado no scan');";
  page += "}";
  
  page += "async function status(){";
  page += "try{const r=await fetch('/wifi/status',{cache:'no-store'});const d=await r.json();";
  page += "ipSta.textContent=d.staIp||'-';";
  page += "ipAp.textContent=d.apIp||'192.168.4.1';";
  page += "if(d.connected){setOk('Conectado ao WiFi: '+(d.ssid||''));";
  page += "const host=String(window.location.hostname||'');";
  page += "if(d.staIp && host!==d.staIp){tipPortal.innerHTML=\"Conectado. Você pode acessar por WiFi: <a href='http://\"+d.staIp+\"/' style='color:#9fd0ff;font-weight:900'>http://\"+d.staIp+\"/</a> (AP também continua ativo em 192.168.4.1)\";} else { tipPortal.textContent='Conectado. Você pode testar as portas por aqui.'; }";
  page += "} else {setInfo('Não conectado. Configure e conecte.'); tipPortal.textContent='AP sempre disponível. Conecte no WiFi do ESP: '+(d.apSsid||'AIRE')+' e abra 192.168.4.1 para configurar.';}";
  page += "}catch(e){setErr('Falha ao obter status');}";
  page += "}";
  
  page += "async function conectar(){";
  page += "const ssid=document.getElementById('ssid').value.trim();";
  page += "const senha=document.getElementById('senha').value;";
  page += "if(!ssid){setErr('Informe o SSID');return;}";
  page += "document.getElementById('btnConn').disabled=true;";
  page += "setInfo('Conectando...');";
  page += "try{const res=await fetch('/wifi/conectar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'ssid='+encodeURIComponent(ssid)+'&senha='+encodeURIComponent(senha)});";
  page += "const d=await res.json();";
  page += "if(d.ok){setOk('Conectado! IP: '+(d.ip||'-'));ipSta.textContent=d.ip||'-';}";
  page += "else{setErr('Erro ao conectar. Verifique SSID/senha.');}";
  page += "}catch(e){setErr('Erro ao conectar');}finally{document.getElementById('btnConn').disabled=false;}";
  page += "}";
  
  page += "async function desconectar(){";
  page += "setInfo('Desconectando...');";
  page += "try{await fetch('/wifi/desconectar',{method:'POST'});setOk('Desconectado.');await status();}catch(e){setErr('Falha ao desconectar');}";
  page += "}";
  
  page += "async function limpar(){";
  page += "setInfo('Limpando WiFi salvo...');";
  page += "try{await fetch('/wifi/reset',{method:'POST'});setOk('WiFi salvo limpo.');document.getElementById('ssid').value='';document.getElementById('senha').value='';await status();}catch(e){setErr('Falha ao limpar');}";
  page += "}";
  
  page += "async function testar(p){";
  page += "portaStatus.className='status';portaStatus.textContent='Testando porta '+p+'...';";
  page += "try{const r=await fetch('/teste/abrir?porta='+encodeURIComponent(p),{cache:'no-store'});";
  page += "let d=null; try{d=await r.json();}catch(_){d=null;}";
  page += "if(r.ok && d && d.ok){portaStatus.className='status ok';portaStatus.textContent='Pulso enviado na porta '+p+'.';}";
  page += "else{portaStatus.className='status err';portaStatus.textContent='Erro ao testar ('+r.status+'): '+((d&&d.erro)?d.erro:'falha');}";
  page += "}catch(e){portaStatus.className='status err';portaStatus.textContent='Erro ao testar (sem conexão com o ESP)';}";
  page += "}";
  
  page += "status();";
  page += "</script>";
  page += "</div></body></html>";
  
  server.send(200, "text/html", page);
}

void handleWifiSalvar() {
  if (!requireAuth()) return;
  if (!server.hasArg("ssid")) {
    server.send(400, "application/json", "{\"erro\":\"ssid_obrigatorio\"}");
    return;
  }

  String ssid = server.arg("ssid");
  String senha = server.hasArg("senha") ? server.arg("senha") : String("");
  ssid.trim();

  if (!ssid.length()) {
    server.send(400, "application/json", "{\"erro\":\"ssid_obrigatorio\"}");
    return;
  }

  salvarCredenciaisWiFi(ssid, senha);
  wifiSsid = ssid;
  wifiPassword = senha;

  server.send(200, "application/json", "{\"ok\":true}");
}

void handleWifiReset() {
  if (!requireAuth()) return;
  limparCredenciaisWiFi();
  wifiSsid = "";
  wifiPassword = "";
  WiFi.disconnect(true, true);
  modoConfig = true;
  ensureAPRunning();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleWifiStatus() {
  if (!requireAuth()) return;
  bool connected = WiFi.status() == WL_CONNECTED;
  atualizarIP();
  String json;
  json.reserve(256);
  json += "{";
  json += "\"connected\":" + String(connected ? "true" : "false") + ",";
  json += "\"modeConfig\":" + String(modoConfig ? "true" : "false") + ",";
  json += "\"ssid\":\"" + jsonEscape(wifiSsid) + "\",";
  json += "\"ip\":\"" + jsonEscape(currentIP) + "\",";
  json += "\"staIp\":\"" + jsonEscape(staIP) + "\",";
  json += "\"apIp\":\"" + jsonEscape(apIP) + "\",";
  json += "\"apSsid\":\"" + jsonEscape(String("AIRE-") + deviceId) + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

void handleWifiConectar() {
  if (!requireAuth()) return;
  if (!server.hasArg("ssid")) {
    server.send(400, "application/json", "{\"ok\":false,\"erro\":\"ssid_obrigatorio\"}");
    return;
  }
  String ssid = server.arg("ssid");
  String senha = server.hasArg("senha") ? server.arg("senha") : String("");
  ssid.trim();
  if (!ssid.length()) {
    server.send(400, "application/json", "{\"ok\":false,\"erro\":\"ssid_obrigatorio\"}");
    return;
  }

  wifiSsid = ssid;
  wifiPassword = senha;
  salvarCredenciaisWiFi(ssid, senha);

  WiFi.mode(WIFI_AP_STA);
  modoConfig = true;
  ensureAPRunning();
  WiFi.disconnect(false, false);
  delay(100);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  ensureAPRunning();

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI) {
    delay(250);
    server.handleClient();
  }

  bool ok = WiFi.status() == WL_CONNECTED;
  atualizarIP();

  if (ok) {
    modoConfig = false;
    disableAP();
  }

  String json;
  json.reserve(256);
  json += "{";
  json += "\"ok\":" + String(ok ? "true" : "false") + ",";
  json += "\"ssid\":\"" + jsonEscape(wifiSsid) + "\",";
  json += "\"ip\":\"" + jsonEscape(currentIP) + "\"";
  if (!ok) json += ",\"erro\":\"falha_conectar\"";
  json += "}";
  server.send(ok ? 200 : 500, "application/json", json);
}

void handleWifiDesconectar() {
  if (!requireAuth()) return;
  WiFi.disconnect(true, true);
  modoConfig = true;
  ensureAPRunning();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleTesteAbrir() {
  if (!requireAuth()) return;
  if (!server.hasArg("porta")) {
    server.send(400, "application/json", "{\"ok\":false,\"erro\":\"porta_obrigatoria\"}");
    return;
  }
  int porta = server.arg("porta").toInt();
  if (porta < 1 || porta > NUM_PORTAS) {
    server.send(400, "application/json", "{\"ok\":false,\"erro\":\"porta_invalida\"}");
    return;
  }
  abrirPorta(porta);
  server.send(200, "application/json", "{\"ok\":true}");
}

/* =====================================================
   CONTROLE PORTAS
   ===================================================== */

void abrirPorta(int porta) {
  int i = porta - 1;
  if (i < 0 || i >= NUM_PORTAS) return;

  digitalWrite(PORTAS_RELE[i], RELE_LIGADO);
  pulsoAtivo[i] = true;
  tempoPulso[i] = millis();
  portaAberta[i] = true;
}

void verificarPulsos() {
  for (int i = 0; i < NUM_PORTAS; i++) {
    if (pulsoAtivo[i] &&
        millis() - tempoPulso[i] >= TEMPO_PULSO) {

      digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
      pulsoAtivo[i] = false;
      portaAberta[i] = false;
    }
  }
}

/* =====================================================
   AUTORIZAÇÃO
   ===================================================== */

bool autorizado() {

  if (!server.hasArg("condominio_uid") ||
      !server.hasArg("porta_uid") ||
      !server.hasArg("porta") ||
      !server.hasArg("token"))
    return false;

  String base =
    server.arg("condominio_uid") + ":" +
    server.arg("porta_uid") + ":" +
    server.arg("porta") + ":" +
    AIRE_ESP_SECRET;

  return sha256(base).equalsIgnoreCase(server.arg("token"));
}

/* =====================================================
   ROTAS
   ===================================================== */

void handleDiscovery() {

  String json = "{";
  json += "\"device\":\"AIRE-ESP32\",";
  json += "\"id\":\"" + deviceId + "\",";
  json += "\"fw\":\"" + String(FW_VERSION) + "\",";
  json += "\"ip\":\"" + currentIP + "\"";
  json += "}";

  server.send(200, "application/json", json);
}

void handleAbrir() {

  if (!autorizado()) {
    server.send(401, "application/json", "{\"erro\":\"nao_autorizado\"}");
    return;
  }

  int porta = server.arg("porta").toInt();
  abrirPorta(porta);

  server.send(200, "application/json", "{\"ok\":true}");
}

/* =====================================================
   SETUP
   ===================================================== */

void setup() {

  Serial.begin(115200);
  delay(2000);

  Serial.println("\n===== AIRE ESP32 INICIANDO =====");

  pinMode(2, OUTPUT);   // LED
  digitalWrite(2, LOW);

  deviceId = gerarDeviceId();

  for (int i = 0; i < NUM_PORTAS; i++) {
    pinMode(PORTAS_RELE[i], OUTPUT);
    digitalWrite(PORTAS_RELE[i], RELE_DESLIGADO);
    pinMode(PORTAS_SENSOR[i], INPUT_PULLUP);
  }

  carregarCredenciaisWiFi();
  if (!conectarWiFi()) {
    iniciarModoConfig();
  }

  server.on("/discovery", handleDiscovery);
  server.on("/abrir", handleAbrir);
  server.on("/", HTTP_GET, handleWifi);
  server.on("/wifi", HTTP_GET, handleWifi);
  server.on("/wifi/scan", HTTP_GET, handleWifiScan);
  server.on("/wifi/status", HTTP_GET, handleWifiStatus);
  server.on("/wifi/conectar", HTTP_POST, handleWifiConectar);
  server.on("/wifi/desconectar", HTTP_POST, handleWifiDesconectar);
  server.on("/wifi/salvar", HTTP_POST, handleWifiSalvar);
  server.on("/wifi/reset", HTTP_POST, handleWifiReset);
  server.on("/teste/abrir", HTTP_GET, handleTesteAbrir);

  server.begin();

  Serial.println("[AIRE] Servidor iniciado!");
}

/* =====================================================
   LOOP
   ===================================================== */

void loop() {

  verificarPulsos();
  server.handleClient();

  if (modoConfig && millis() - tempoApCheck >= 5000) {
    tempoApCheck = millis();
    ensureAPRunning();
  }

  if (WiFi.status() == WL_CONNECTED && modoConfig) {
    modoConfig = false;
    disableAP();
    Serial.println("[AIRE] WiFi conectado, desligando o AP do modo configuração.");
  }

  // Controle do LED
  unsigned long intervalo;

  if (WiFi.status() == WL_CONNECTED) {
    intervalo = 1000;  // pisca lento
  } else {
    intervalo = 250;   // pisca rápido
  }

  if (millis() - tempoLed >= intervalo) {
    tempoLed = millis();
    estadoLed = !estadoLed;
    digitalWrite(2, estadoLed);
  }
}
