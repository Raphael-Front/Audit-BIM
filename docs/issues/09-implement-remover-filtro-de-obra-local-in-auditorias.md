# Implement "remover filtro de obra local" in Auditorias

## Overview

Remover o dropdown de obra local da tela de Auditorias ([src/views/AuditoriasPage.tsx](src/views/AuditoriasPage.tsx), `<select>` com `value={workId}`), já que a seleção agora é global pelo `ObraSelector` da topbar. Manter os filtros secundários (fase, status).
