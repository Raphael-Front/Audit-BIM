# Audit BIM — Seletor Global de Obra (MVP)

## Overview

Permitir que o usuário selecione **uma obra** (ou **"Todas as obras"**) num seletor fixo no topo do app, fazendo com que **todo o sistema opere no contexto dessa obra**. A seleção é única, global e persistente entre páginas e sessões — eliminando os filtros de obra locais e duplicados que existem hoje em cada tela.

**Core job-to-be-done:**
> Quando estou trabalhando em uma obra específica, quero que o sistema inteiro foque nela, para ver e gerenciar apenas os dados daquela obra sem precisar re-filtrar em cada tela.

**Escopo do MVP:** seletor global + filtragem em Dashboard, Auditorias e Nova Auditoria. A **Biblioteca permanece global** (não filtra). Relatórios, NCs e Logs ficam para a próxima iteração.

---

## App Shell (Topbar)

Estrutura comum a todas as telas autenticadas; abriga o seletor de obra global.

### Components

- **ObraSelector**: dropdown/combobox na topbar que mostra a obra atual e lista "Todas as obras" + todas as obras ativas.
- **ObraSelectorBadge**: rótulo que exibe o nome da obra selecionada (ou "Todas as obras") de forma persistente.

### Behaviors

- **selecionar obra**: ao escolher uma obra na lista, o contexto global muda e todas as telas abertas re-buscam dados apenas daquela obra, sem reload.
- **selecionar todas as obras**: ao escolher "Todas as obras", o sistema passa a exibir a visão consolidada (sem filtro de obra).
- **persistir seleção**: a obra escolhida é salva por usuário e restaurada ao navegar entre páginas e ao reabrir o sistema (default: "Todas as obras").
- **buscar obra**: ao digitar no seletor, a lista filtra obras por nome.

---

## Dashboard

Visão de métricas e indicadores, agora vinculada à obra global.

### Components

- **DashboardStats**: cartões de métricas (auditorias, itens, próxima auditoria) referentes à obra selecionada.
- **DashboardCharts**: gráficos (piores disciplinas, erros por categoria, scores) referentes à obra selecionada.

### Behaviors

- **carregar dashboard pela obra global**: ao abrir, o dashboard usa a obra do contexto global (`workId`) em vez de um filtro local.
- **consolidar em todas as obras**: quando o contexto é "Todas as obras", as métricas somam/agregam todas as obras.

---

## Auditorias (Lista)

Listagem e acompanhamento de auditorias, filtrada pela obra global.

### Components

- **AuditoriasList**: tabela de auditorias da obra selecionada (com identificação da obra quando em "Todas").
- **AuditoriasFilters**: filtros secundários (fase, status) — sem o dropdown de obra local.

### Behaviors

- **listar auditorias pela obra global**: a lista exibe apenas auditorias da obra selecionada; em "Todas", exibe de todas as obras.
- **remover filtro de obra local**: o dropdown de obra próprio da tela é removido em favor do seletor global.

---

## Nova Auditoria

Formulário de criação de auditoria, integrado ao contexto de obra.

### Components

- **NovaAuditoriaForm**: formulário com campo de obra pré-preenchido a partir do contexto global.

### Behaviors

- **pré-selecionar obra global**: se há uma obra específica no contexto, o campo de obra já vem preenchido com ela (ainda editável).
- **exigir obra em "todas"**: se o contexto é "Todas as obras", o campo de obra é obrigatório antes de salvar.

---

## Biblioteca (fora do filtro)

A Biblioteca (disciplinas, categorias, itens de checklist) é **compartilhada entre todas as obras** e **não** é afetada pelo seletor.

### Components

- **BibliotecaGlobalHint**: aviso sutil indicando que a biblioteca é compartilhada entre todas as obras.

### Behaviors

- **ignorar contexto de obra**: a biblioteca exibe os mesmos modelos independentemente da obra selecionada.

---

## Job Stories

- Quando abro o sistema para acompanhar uma obra específica, quero escolhê-la uma única vez, para que todas as telas já venham filtradas por ela.
- Quando troco de obra no seletor, quero que o dashboard e as auditorias atualizem na hora, para comparar o andamento sem reconfigurar filtros.
- Quando preciso de uma visão geral, quero escolher "Todas as obras", para ver os números consolidados da empresa.
- Quando crio uma nova auditoria já dentro de uma obra, quero que a obra venha preenchida, para não repetir a seleção e evitar erro.
