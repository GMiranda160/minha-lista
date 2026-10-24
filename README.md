# Minha Lista

Lista de compras inteligente que aprende com os seus hábitos. Você monta a lista no celular ou no computador, imprime, e o app registra cada lista impressa como um **ciclo de compra**. Com o histórico de ciclos ele descobre o padrão de cada produto (regular, esporádico, em queda...) e recomenda o que está na hora de comprar e em que quantidade.

## Funcionalidades

- **Minha Lista**: catálogo em cartões por categoria, busca sem acentos, ordenação alfabética ou por frequência, seleção com quantidade e uma "notinha" com os itens escolhidos.
- **Recomendações**: produtos com padrão consolidado ("Garantidos") e produtos ainda em aprendizado, com quantidade sugerida pela mediana das últimas compras.
- **Impressão**: abre a lista em A4 paisagem, em colunas, ajustando fonte e número de colunas para caber em uma folha. Ao confirmar, a lista vira um novo ciclo.
- **Catálogo**: cadastrar, editar, excluir e ocultar produtos (produto oculto sai da lista e congela o padrão).
- **Relatórios**: visão anual e mensal, análise por produto, tabela técnica do motor de recomendação e gerenciador de ciclos (editar, excluir com renumeração, reimprimir, exportar e importar um ciclo).
- **Conta e backup**: login por e-mail e senha (Supabase Auth). Cada usuário só acessa os próprios dados. Exportar e importar backup em JSON, inclusive o `lista.json` do antigo app desktop.

## Regras do projeto

Estas regras valem para todo código e texto deste repositório.

1. **Arquitetura do software**
   - **Tecnologias**: Next.js (App Router) + TypeScript, PostgreSQL no Supabase (com Supabase Auth), deploy na Vercel.
   - **Modular**, separado nas camadas abaixo: Telas, Processamento, Comunicação e Dados, mais a Base.
2. **Não usar travessões** em textos, comentários, mensagens da interface ou documentação. Use dois pontos, vírgula ou parênteses.
3. **Programação limpa e eficiente**: funções pequenas com nomes claros, sem código morto, sem duplicação, sem consultas ou gravações desnecessárias (o app grava só o que mudou).
4. **Reutilização de código**: antes de criar algo novo, procure em `src/ui/components` e `src/domain`. Lógica nunca é copiada entre telas.
5. **Commits**: os commits são feitos pelo Guilherme. Ferramentas e assistentes preparam as alterações, mas não fazem commit nem push.

## Arquitetura

```
┌────────────────────────────────────────────────────────────┐
│ TELAS (UI)              src/app, src/ui                    │
│ Páginas, componentes, estilos e o store do cliente         │
└──────────────┬─────────────────────────────┬───────────────┘
               │ chama                       │ usa
┌──────────────▼──────────────┐ ┌────────────▼───────────────┐
│ COMUNICAÇÃO                 │ │ PROCESSAMENTO              │
│ src/services, src/proxy.ts  │ │ src/domain                 │
│ Server Actions, sessão,     │ │ Regras e cálculos puros:   │
│ login, confirmação de       │ │ ciclos, padrões, score,    │
│ e-mail                      │ │ recomendações, relatórios  │
└──────────────┬──────────────┘ └────────────▲───────────────┘
               │ chama                       │ usa
┌──────────────▼─────────────────────────────┴───────────────┐
│ DADOS                   src/data                           │
│ Cliente Supabase, repositório e conversão linha/objeto     │
└──────────────┬─────────────────────────────────────────────┘
               │ SQL / RPC
┌──────────────▼─────────────────────────────────────────────┐
│ BASE                    supabase/migrations                │
│ Tabelas, RLS e funções transacionais no PostgreSQL         │
└────────────────────────────────────────────────────────────┘
```

| Camada | Pasta | Responsabilidade | Pode importar |
|---|---|---|---|
| Telas | `src/app`, `src/ui` | Rotas, componentes React, CSS, estado da tela | Processamento, Comunicação |
| Processamento | `src/domain` | Regras de negócio puras (sem banco, sem React, sem rede) | nada além de si mesma |
| Comunicação | `src/services`, `src/proxy.ts`, rotas em `src/app/auth` | Server Actions, autenticação, proteção de rotas | Processamento, Dados |
| Dados | `src/data` | Acesso ao Supabase, consultas, conversões | Processamento (tipos) |
| Base | `supabase/migrations` | Esquema SQL, políticas RLS, funções | |

**Fluxo de uma alteração** (ex.: selecionar um produto):

1. A tela chama `store.apply(estado => toggleSelection(estado, id))`.
2. O domínio devolve um **novo** estado (as funções são puras e imutáveis).
3. O store atualiza a tela na hora e calcula a diferença com `diffState` (`src/domain/changes.ts`).
4. A diferença vai, em fila, para a Server Action `saveChanges`, que chama o repositório.
5. O repositório executa a função `apply_changes` no PostgreSQL, que aplica tudo em **uma transação**, protegida por RLS.

### Banco de dados

- `products`: catálogo do usuário, estado da lista atual (`selected`, `quantity`) e o padrão de compra calculado (`pattern`, JSONB).
- `purchases`: histórico; uma linha por produto comprado em um ciclo (`product_id`, `cycle`, `date`, `quantity`).
- `user_settings`: contador de ciclos, último decaimento e preferência de ordenação.
- Funções: `apply_changes` (grava diferenças em uma transação) e `import_backup` (restaura um backup completo).

Todas as tabelas têm RLS: cada linha pertence a `auth.uid()`.

## Estrutura de pastas

```
src/
  app/                 Telas: rotas do Next (login, lista, catálogo, relatórios)
  ui/
    components/        Componentes reutilizáveis (Modal, StatCard, SearchField...)
    features/          Telas por funcionalidade (lista, catalogo, relatorios, auth)
    layout/            Casca: menu lateral no PC, abas inferiores no celular
    store/             Store do cliente (atualização otimista + fila de gravação)
    lib/               Utilitários de navegador (download, impressão)
  domain/              Processamento: tipos, ciclos, padrões, recomendações, relatórios
  services/            Comunicação: Server Actions e sessão
  data/                Dados: Supabase e repositório
  proxy.ts             Renova a sessão e protege as rotas
supabase/migrations/   Base: esquema SQL
tests/                 Testes do domínio (Vitest)
```

## Como rodar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode o arquivo `supabase/migrations/20261024000000_init.sql` (ou use `supabase db push` com a CLI).
3. Em **Authentication > URL Configuration**, configure:
   - **Site URL**: a URL de produção (ex.: `https://minha-lista.vercel.app`).
   - **Redirect URLs**: `http://localhost:3000/auth/confirm` e `https://SEU-DOMINIO/auth/confirm`.
4. Em **Project Settings > API**, copie a URL do projeto e a chave **publishable** (ou a `anon`).

### 2. Ambiente local

Requisitos: Node.js 20 ou mais novo.

```bash
cp .env.example .env.local   # preencha com a URL e a chave do Supabase
npm install
npm run dev                  # http://localhost:3000
```

No Windows, basta dar dois cliques em `rodar-dev.bat`: ele confere o Node e o `.env.local`, instala as dependências na primeira vez, sobe o servidor e abre o navegador.

### 3. Deploy na Vercel

1. Importe este repositório do GitHub na Vercel.
2. Em **Environment Variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. A cada push na branch principal a Vercel publica uma nova versão.

### Trazer os dados do app desktop

Entre no app, abra o menu **Dados > Importar backup** e escolha o `lista.json` (fica em `Documentos/Lista_de_compras`) ou um backup exportado pelo app antigo. Produtos, ciclos e padrões são importados.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos do TypeScript |
| `npm test` | Testes do domínio (Vitest) |
