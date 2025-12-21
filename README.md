# Sistema de Gaveteiros

Sistema para controle eletrônico de gaveteiros/armários com integração ESP32.

## Tecnologias

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL)
- **Hardware**: ESP32/ESP31

## Instalação

1. **Instalar dependências:**

```bash
npm install
```

2. **Configurar variáveis de ambiente:**

Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais do Supabase:

```bash
cp .env.example .env
```

Edite o `.env`:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

3. **Rodar o projeto:**

```bash
npm run dev
```

O sistema estará disponível em `http://localhost:3000`

## Estrutura do Banco de Dados (Schema: gaveteiro)

### Tabelas

- **condominios**: Empresas/condomínios (multi-tenant)
- **gaveteiros**: Armários físicos (cada ESP32)
- **portas**: Gavetas individuais de cada armário
- **autorizacoes_porta**: Permissões de acesso por usuário/perfil
- **movimentacoes_porta**: Histórico de ações (abrir, fechar, baixar)

### Status das Portas

- `DISPONIVEL`: Porta livre para uso
- `OCUPADO`: Porta em uso
- `AGUARDANDO_RETIRADA`: Marcado para retirada
- `BAIXADO`: Item retirado, aguardando liberação

## Funcionalidades

- [x] Listar condomínios
- [x] Listar gaveteiros por condomínio
- [x] Visualizar status das portas em tempo real
- [x] Abrir porta (comando)
- [x] Dar baixa (marcar como retirado)
- [x] Liberar porta (voltar para disponível)
- [x] Mostrar tempo de ocupação
- [ ] Integração MQTT com ESP32
- [ ] Autenticação de usuários
- [ ] Validação de senha por porta

## Próximos Passos

1. Configurar comunicação MQTT com ESP32
2. Implementar autenticação de usuários
3. Adicionar validação de senha por porta
4. Criar tela de histórico de movimentações
5. Implementar notificações em tempo real (Supabase Realtime)

## Licença

Proprietário - Todos os direitos reservados.
