# Implement "persistir seleção" in App Shell

## Overview

Persistir a obra selecionada por usuário, de forma que ela seja mantida ao navegar entre páginas e restaurada ao reabrir o sistema.

- Salvar a seleção em `localStorage` (chave por usuário, ex.: `auditbim:selectedObra:<userId>`).
- Restaurar no carregamento do `ObraContext`; default `"all"` (Todas as obras) quando não houver valor salvo.
- Tratar caso de obra salva inexistente/inativa → voltar para "Todas as obras".
