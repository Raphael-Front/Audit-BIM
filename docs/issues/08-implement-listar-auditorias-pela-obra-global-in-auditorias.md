# Implement "listar auditorias pela obra global" in Auditorias

## Overview

Fazer a lista de auditorias filtrar pela obra do `ObraContext`.

- Em [src/views/AuditoriasPage.tsx](src/views/AuditoriasPage.tsx), usar `selectedObraId` em vez do `workId` local ao montar `queryParams`/`queryKey`.
- Em "Todas as obras", listar de todas (incluindo identificação da obra em cada linha).
