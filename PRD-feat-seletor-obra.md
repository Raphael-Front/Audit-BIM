# PRD — Seletor Global de Obra (Audit BIM)

> **Status:** Proposto
> **Autor:** Raphael Souza (com Claude Code)
> **Data:** 2026-06-22
> **Feature:** Seletor de obra global que define o contexto de toda a aplicação.

---

## 1. Resumo

Adicionar um **seletor de obra global** no topo do app (AppShell), sempre visível. Ao escolher uma obra, **todo o sistema passa a operar no contexto daquela obra** — Dashboard, Auditorias, Relatórios, Não Conformidades, Logs e a criação de novas auditorias passam a refletir apenas os dados da obra selecionada. Existe também a opção **"Todas as obras"** para uma visão consolidada.

A **Biblioteca** (disciplinas, categorias e itens de checklist) é **global/compartilhada** e **não** é filtrada pela obra — os modelos são reutilizáveis entre obras (decisão de produto, ver §3).

---

## 2. Problema atual

Hoje o filtro de obra é **local e duplicado** em cada tela:

- `DashboardPage` tem seu próprio estado `workId` + dropdown ([src/views/DashboardPage.tsx:48](src/views/DashboardPage.tsx)).
- `AuditoriasPage` tem outro `workId` + dropdown independente ([src/views/AuditoriasPage.tsx:103](src/views/AuditoriasPage.tsx)).
- `AuditoriaNewPage` pede a obra do zero ([src/views/AuditoriaNewPage.tsx:63](src/views/AuditoriaNewPage.tsx)).

Consequências:
- A seleção **reseta ao trocar de página** — o usuário escolhe a obra no Dashboard e, ao ir para Auditorias, precisa escolher de novo.
- Não existe um "contexto de obra" coeso; cada tela vive isolada.
- Não há visão consolidada padronizada de "todas as obras".

O backend **já suporta** o filtro: as funções de dados aceitam `filters.workId` e aplicam `.eq("obraId", workId)` (ex.: `DashboardFilters` e `getFilteredAuditIds` em [src/lib/api.ts](src/lib/api.ts)). Falta apenas **centralizar a seleção** e fazer todas as telas consumirem esse estado único.

---

## 3. Decisões de produto (confirmadas)

| Tema | Decisão |
|---|---|
| **Escopo da Biblioteca** | **Global (compartilhada).** A biblioteca de disciplinas/categorias/checklists é a mesma para todas as obras; o seletor **não** a filtra. |
| **Opção "Todas as obras"** | **Sim.** Há uma opção de visão consolidada (agrega dados de todas as obras). |
| **Acesso por usuário** | **Todos veem todas as obras.** Sem vínculo usuário↔obra (sem mudança no banco nesta versão). |
| **Padrão ao entrar** | **"Todas as obras"** por padrão. |

---

## 4. Escopo

### Dentro do escopo
- Componente **seletor de obra** no topo (AppShell), visível em todas as telas autenticadas.
- **Estado global** da obra selecionada (novo `ObraContext`), com persistência por usuário.
- Opção **"Todas as obras"** (visão consolidada).
- Refatorar as telas para **consumir a obra global** em vez de estado local:
  - Dashboard
  - Auditorias (lista) / Auditoria (detalhe)
  - Relatórios (lista e geração)
  - Não Conformidades (NCs)
  - Logs de atividade (quando aplicável)
  - Nova Auditoria (pré-seleciona a obra global)
- Remoção dos dropdowns de obra **locais e duplicados** dessas telas.

### Fora do escopo (desta versão)
- Restrição de obras por usuário (vínculo usuário↔obra).
- Filtrar a Biblioteca por obra.
- Multi-seleção de obras (escolher 2-3 obras ao mesmo tempo). Apenas "uma obra" ou "todas".
- Alterar o modelo de dados (`dim_obras`, `fato_auditorias` etc.) — a coluna `obraId` já existe.

---

## 5. Comportamento por área

### 5.1 Seletor (AppShell)
- Fica na **topbar**, ao lado esquerdo dos ícones de tema/notificações, sempre visível.
- Mostra o nome da obra selecionada; ao abrir, lista:
  - **"Todas as obras"** (primeira opção)
  - Todas as obras ativas (`worksList()` → `dim_obras`, já existente).
- Busca/filtro por nome quando houver muitas obras (combobox).
- Trocar a obra **atualiza o app inteiro imediatamente** (sem reload) e re-busca os dados das telas abertas.

### 5.2 Dashboard
- Com obra específica: todas as métricas, gráficos e listas refletem só aquela obra.
- Com "Todas as obras": visão consolidada (comportamento atual com `workId` indefinido).
- Remover o dropdown de obra local do Dashboard.

### 5.3 Auditorias (lista + detalhe)
- Lista filtra pela obra global. "Todas" mostra de todas as obras (com coluna/identificação da obra).
- Remover o dropdown de obra local.
- Detalhe da auditoria: indica claramente a obra a que pertence.

### 5.4 Nova Auditoria
- Se houver **obra específica** selecionada, **pré-seleciona** essa obra no formulário (ainda editável).
- Se estiver em **"Todas as obras"**, o usuário escolhe a obra normalmente (campo obrigatório).

### 5.5 Relatórios
- Geração e listagem respeitam a obra global.
- "Todas as obras": relatório consolidado (quando fizer sentido) ou solicitação de escolher uma obra para relatórios que exigem obra única (definir por tipo de relatório).

### 5.6 Não Conformidades / Logs
- NCs filtram pela obra global.
- Logs de atividade: filtram por obra quando o registro tiver vínculo de obra; caso contrário, permanecem globais (decisão de implementação por evento).

### 5.7 Biblioteca (Templates) — **não filtra**
- A Biblioteca permanece **global** independentemente da obra selecionada (decisão §3).
- Opcional (UX): exibir um aviso sutil "Biblioteca é compartilhada entre todas as obras" para evitar confusão.

---

## 6. Especificação técnica

### 6.1 Estado global — `ObraContext`
Seguir o padrão dos contexts existentes ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx), `ThemeContext`).

```ts
// src/contexts/ObraContext.tsx
type ObraSelection = string | "all";   // id da obra ou "all" (Todas)
type ObraContextValue = {
  selectedObraId: string | null;       // null quando "Todas"
  selection: ObraSelection;            // "all" | <obraId>
  setSelection: (s: ObraSelection) => void;
  obras: WorkRow[];                    // de worksList()
  selectedObra: WorkRow | null;
  isAll: boolean;
};
```

- Provider montado dentro do `Providers`/`AppShell` (área autenticada).
- Carrega `worksList()` via React Query (cacheado).
- **Persistência:** `localStorage` por usuário (chave ex.: `auditbim:selectedObra:<userId>`). Default = `"all"`.
- Helper de conveniência: `selectedObraId` para passar direto como `filters.workId` (quando `"all"` → `undefined`).

### 6.2 Seletor (UI)
- Novo componente `ObraSelector` renderizado na topbar do [src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx).
- Reusa estilo dos `<select>` existentes ou um combobox (Radix/shadcn já presentes).

### 6.3 Consumo nas telas
- Substituir `const [workId, setWorkId] = useState("")` das telas por `const { selectedObraId } = useObra()`.
- Remover os `<select>` de obra locais (Dashboard, Auditorias).
- Passar `workId: selectedObraId ?? undefined` para as funções de `api.ts` (que já aceitam).

### 6.4 React Query
- **Incluir a obra selecionada nas `queryKey`** de todas as queries afetadas, ex.:
  `queryKey: ["audits", selectedObraId, phaseId, statusFilter]`.
  Assim, trocar a obra invalida/re-busca automaticamente.
- Conferir todas as funções de dados em `api.ts` para garantir que aceitam e aplicam `workId` (a maioria já aceita; mapear as que faltam — ex.: NCs, listas específicas).

### 6.5 Backend / dados
- Sem migração de schema. `fato_auditorias.obraId` e `dim_obras` já existem.
- Auditar funções em `api.ts` que ainda **não** recebem `workId` e que deveriam respeitar o contexto (lista de NCs, relatórios, etc.) e adicionar o parâmetro.

---

## 7. Casos de borda
- **Obra selecionada foi excluída/inativada:** voltar para "Todas as obras" e avisar.
- **Usuário sem nenhuma obra cadastrada:** seletor mostra só "Todas as obras"; telas exibem estados vazios.
- **Primeiro acesso:** default "Todas as obras" (sem forçar escolha).
- **Nova auditoria em "Todas":** obra é campo obrigatório no formulário.
- **Relatório que exige obra única estando em "Todas":** pedir para selecionar uma obra antes de gerar.
- **Troca de obra com formulário aberto/não salvo:** confirmar antes de trocar (evitar perda de dados).

---

## 8. Critérios de aceite
1. Há um seletor de obra na topbar, visível em todas as telas autenticadas.
2. A seleção **persiste** ao navegar entre páginas e entre sessões (mesmo usuário).
3. Selecionar uma obra filtra Dashboard, Auditorias, Relatórios e NCs para aquela obra, sem reload.
4. "Todas as obras" mostra a visão consolidada.
5. Os dropdowns de obra locais e duplicados foram removidos.
6. "Nova Auditoria" pré-seleciona a obra global quando há uma específica.
7. A Biblioteca permanece igual independentemente da obra.
8. Trocar a obra re-busca os dados automaticamente (React Query keys atualizadas).

---

## 9. Plano de implementação (fases)
1. **Contexto + provider:** criar `ObraContext` (carrega `worksList`, persiste seleção, default "all").
2. **Seletor na topbar:** `ObraSelector` no AppShell.
3. **Dashboard:** trocar estado local pelo contexto; remover dropdown; incluir obra na queryKey.
4. **Auditorias (lista/detalhe) + Nova Auditoria:** consumir contexto; pré-seleção; remover dropdowns.
5. **Relatórios + NCs + Logs:** aplicar filtro do contexto; ajustar funções de `api.ts` faltantes.
6. **Casos de borda + estados vazios + polimento de UX.**
7. **Testes** (Playwright): seleção persiste, filtro aplica, "Todas" consolida.

---

## 10. Perguntas em aberto
- Relatórios: quais tipos podem ser **consolidados** em "Todas as obras" e quais **exigem** uma obra única?
- Logs de atividade: todo evento deve ter vínculo de obra, ou alguns permanecem globais?
- O seletor deve aparecer também em telas de configuração/perfil (provavelmente não filtra nada lá)?
