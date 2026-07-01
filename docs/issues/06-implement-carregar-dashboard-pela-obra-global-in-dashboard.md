# Implement "carregar dashboard pela obra global" in Dashboard

## Overview

Fazer o Dashboard usar a obra do `ObraContext` em vez do estado local `workId`.

- Substituir `const [workId, setWorkId] = useState("")` em [src/views/DashboardPage.tsx](src/views/DashboardPage.tsx) por `useObra()`.
- Passar `workId: selectedObraId ?? undefined` para as funções de stats/gráficos (já aceitam `filters.workId`).
- Incluir `selectedObraId` nas `queryKey` para re-buscar ao trocar de obra.
