# Implement App Shell obra selector components

## Overview

Front-end prototype dos componentes do seletor global de obra na topbar do AppShell, sem comportamento ainda (apenas UI + estrutura de estado).

- `ObraSelector`: dropdown/combobox na topbar de [src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx) listando "Todas as obras" + obras (de `worksList()` em [src/lib/api.ts](src/lib/api.ts)).
- `ObraSelectorBadge`: rótulo exibindo a obra atual (ou "Todas as obras").
- Scaffold do `ObraContext` (provider) seguindo o padrão de [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)/`ThemeContext`, expondo `selectedObraId`, `selection`, `setSelection`, `obras`, `isAll` — ainda sem persistência nem filtragem.

Apenas a casca visual e o contexto base; o fio dos comportamentos vem nas issues seguintes. Default visual: "Todas as obras".
