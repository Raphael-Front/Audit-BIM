# Implement "pré-selecionar obra global" in Nova Auditoria

## Overview

No formulário de nova auditoria ([src/views/AuditoriaNewPage.tsx](src/views/AuditoriaNewPage.tsx)), inicializar o campo de obra (`workId`) com a obra do `ObraContext` quando houver uma específica selecionada — mantendo o campo editável.
