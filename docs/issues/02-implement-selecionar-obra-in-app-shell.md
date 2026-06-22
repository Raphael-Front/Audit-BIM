# Implement "selecionar obra" in App Shell

## Overview

Ao escolher uma obra no `ObraSelector`, o `ObraContext` passa a guardar aquela obra (`selectedObraId`) e todas as telas que consomem o contexto re-buscam dados apenas dela, sem reload.

Inclui expor `selectedObraId` (null quando "Todas") para uso direto como `filters.workId` nas funções de `api.ts`, e garantir que a troca dispare re-fetch (via React Query keys nas issues das telas).
