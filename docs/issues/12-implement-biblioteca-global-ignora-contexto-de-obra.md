# Implement "biblioteca global ignora contexto de obra"

## Overview

Garantir que a Biblioteca (disciplinas, categorias, itens de checklist) **não** seja afetada pelo seletor de obra — ela é compartilhada entre todas as obras.

- Confirmar que [src/views/TemplatesPage.tsx](src/views/TemplatesPage.tsx)/`LibraryManagePage` não aplicam `selectedObraId`.
- Adicionar `BibliotecaGlobalHint`: aviso sutil de que a biblioteca é compartilhada entre todas as obras.
