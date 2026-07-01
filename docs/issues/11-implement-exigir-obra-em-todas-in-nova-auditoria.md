# Implement "exigir obra em todas" in Nova Auditoria

## Overview

Quando o contexto for "Todas as obras" (sem obra específica), o campo de obra em [src/views/AuditoriaNewPage.tsx](src/views/AuditoriaNewPage.tsx) é obrigatório: validar e bloquear o salvamento até o usuário escolher uma obra, com mensagem clara.
