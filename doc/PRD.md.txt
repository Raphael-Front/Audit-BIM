PRD — Sistema Web de Auditoria BIM (Interno)

1. Visão Geral
1.1 Nome do produto

BIM Audit Web (nome provisório)

1.2 Contexto / Problema

Atualmente, a Auditoria BIM é realizada em uma planilha com múltiplas colunas e regras operacionais. Isso gera limitações:

dificuldade de rastreabilidade e histórico de alterações

risco de versões diferentes da mesma auditoria

baixa padronização de preenchimento (observações/evidências)

dificuldade de consolidação de indicadores e pontuação

atualmente após achar um problema precisamos abrir um apontamento e retornar a planilha para preencher esse apontamento, tendo que fazer esse processo repetitivo e demorado; gostaria que fosse realizado tudo em cadeia, após auditar o último item da disciplina, abrindo os respectivos apontamentos

retrabalho para gerar relatórios por obra/fase/disciplina

atualmente precisamos consultar diversos documentos e sites para ter a informação se é possível fazer aquela auditoria ou não; o processo se torna repetitivo e demorado; além disso a gente não tem controle das datas prováveis de auditoria ou do tempo que falta para iniciar aquela auditoria

gestão manual de revisões e prazos

preenchimento manual das mesmas informações em campos distintos, tendo que replicar um padrão de tabelas e preencher praticamente os mesmos dados, mudando somente a situação, evidência/observação do apontamento

Ajuste de fluxo (novo): após terminar a verificação dos itens, a auditoria precisa ficar em “stand-by” para que os apontamentos sejam abertos no Construflow e seus códigos/IDs sejam vinculados aos itens. Só depois disso a auditoria pode ser marcada como concluída.

1.3 Objetivo do projeto

Quero conseguir de maneira fácil a informação de um apontamento já registrado antes.

Quero gerar relatórios de todos os apontamentos citados na auditoria, e seus status.

Quero consultar por apontamento, ou fase, facilitando a informação do apontamento, se foi concluído, se não e etc.

Quero incluir uma gestão de cronograma, visto que hoje a auditoria não possui histórico de data de quando foi realizada, data planejada para começar a próxima auditoria.

Quero que ao fim da auditoria o sistema me retorne o resumo dos apontamentos que devem ser abertos com base no preenchimento anterior dos dados. Obs: o preenchimento do código do apontamento (Construflow) deve ser feito em última etapa.

Quero que me dê uma notificação quando possuir um problema não vinculado a um apontamento.

Quero que me dê uma notificação da próxima auditoria marcada.

Quero um calendário dentro do sistema que contenha data do início da auditoria, data planejada da auditoria (data de início e término), data de execução da auditoria. Também controlado por disciplinas e por obras.

Criar um sistema web interno com banco de dados para:

registrar auditorias BIM por obra/fase

executar checklists por disciplina/categoria

armazenar evidências (texto + anexos)

registrar rastreio no Construflow

controlar revisões futuras

calcular pontuação e indicadores

gerar relatórios

Ajuste de fluxo (novo): permitir:

execução da auditoria em múltiplos dias (começar sexta e terminar segunda)

auditoria não pode ser excluída (apenas cancelada/arquivada mantendo histórico)

adicionar itens novos na auditoria (itens personalizados) quando o auditor “esquecer de colocar algo”

1.4 Público-alvo / Usuários

Somente usuários internos do Departamento BIM.

Perfis previstos:

Administrador BIM (configura templates, permissões, itens)

Auditor BIM (cria e executa auditorias)

Leitor (consulta e exporta relatórios)

2. Metas e Não-Metas
2.1 Metas (Goals)

Substituir a planilha por uma solução web com base de dados.

Garantir rastreabilidade total (quem alterou, quando, o quê).

Reduzir tempo de execução da auditoria e geração de relatórios.

Padronizar itens de verificação e critérios.

Permitir gestão multiobra e multifase.

2.2 Não-Metas (Non-goals)

Não é objetivo neste momento:

integrar automaticamente com Construflow via API (pode ser fase futura)

permitir uso por equipes fora do BIM

substituir outras ferramentas BIM (CDE, clash, etc.)

3. Requisitos Funcionais (Functional Requirements)
3.1 Gestão de Obras e Fases

FR-01: Cadastrar obras
FR-02: Cadastrar fases por obra (ex.: EP, Executivo, As Built)
FR-03: Permitir ativar/inativar obras e fases

3.2 Biblioteca de Checklist (Template)

FR-04: Manter biblioteca de itens de auditoria:

Disciplina

Categoria

Item de verificação

Peso

Pontos máximos

Ativo/Inativo

Aplicabilidade por fase da auditoria (novo): itens podem variar conforme a fase da auditoria (ex.: PL audita menos itens que LO)

FR-05: Versionamento lógico

um item inativo não pode ser apagado se já foi usado em auditorias

auditorias antigas devem preservar o item original

3.3 Auditorias

FR-06: Criar auditoria informando:

obra

fase

título/identificador

data de início

auditor responsável

status (ajustado):

Em andamento

Aguardando Apontamentos (Stand-by)

Concluída

Cancelada

FR-07: Ao criar auditoria, gerar os itens (instância do checklist) a partir do template.

FR-07.1 (novo): Continuidade

Uma auditoria pode ser iniciada em um dia e finalizada em outro (ex.: sexta → segunda), mantendo status “Em andamento” até finalizar a verificação.

FR-07.2 (novo): Auditoria não pode ser excluída

Auditorias não podem ser deletadas.

Caso necessário, devem ser marcadas como “Cancelada”, preservando histórico e logs.

FR-07.3 (novo): Itens personalizados

Durante “Em andamento” e “Aguardando Apontamentos”, o auditor pode adicionar itens personalizados na auditoria (não alteram o template).

3.4 Execução da Auditoria

FR-08: Tela de execução por:

disciplina → categoria → itens

FR-09: Status por item:

Não iniciado

Conforme

Não conforme

Observação

Não aplicável (N/A)

FR-10: Evidência/observação por item (texto)

FR-11: Rastreio Construflow

campo para URL/ID/código do apontamento
Obs (ajuste de fluxo): o preenchimento do código do apontamento pode acontecer na etapa “Aguardando Apontamentos”.

FR-12: Próxima revisão

campo de data

regra: se status = “Não conforme”, sistema deve exigir próxima revisão (configurável)

FR-13: Anexos de evidência

upload de imagem/pdf

vinculado ao item

FR-13.1 (novo): Campos condicionais

Campos de observação/evidência avançada e anexos podem ser condicionais (ex.: só habilitar anexos/observação detalhada quando item for “Não conforme”, se desejado).

3.5 Pontuação e Indicadores

FR-14: Pontuação automática por item (configurável)

conforme = 100% pontos

não conforme = 0% pontos

observação = parcial (opcional, definir regra)

N/A = exclui do cálculo

FR-15: Score da auditoria:

geral

por disciplina

por categoria

FR-16: Exibir progresso:

% concluído (itens preenchidos / total aplicável)

pendências

próximos vencimentos

FR-16.1 (novo): regra de progresso

Itens “N/A” são excluídos do denominador.

Itens “Não iniciado” não contam como concluídos.

3.6 Histórico e Auditoria de alterações (Audit Trail)

FR-17: Registrar log de alterações:

usuário

data/hora

entidade alterada (item, auditoria)

valores antes/depois

ações adicionais (novo): incluir eventos como “Finalizar verificação”, “Entrar em stand-by”, “Adicionar item personalizado”, “Concluir auditoria”, “Cancelar auditoria”.

3.7 Relatórios e Exportação

FR-18: Relatório da auditoria com:

identificação da auditoria (obra, fase, datas, auditor)

resumo por disciplina/categoria

lista de não conformidades com evidências e Construflow

score final

FR-18.1 (novo): Relatórios por status

Auditorias aparecem em relatório mesmo em andamento.

Tipos de relatório:

Parcial (Em andamento)

Técnico / Stand-by (Aguardando Apontamentos — itens avaliados, faltam códigos Construflow)

Final (Concluída)

FR-19: Exportar:

PDF

Excel (XLSX)

4. Requisitos Não Funcionais (Non-Functional Requirements)
4.1 Segurança

NFR-01: autenticação obrigatória
NFR-02: controle por perfil (RBAC)
NFR-03: logs de acesso e alterações
NFR-04: sistema interno (acesso restrito por rede/VPN, se aplicável)

4.2 Confiabilidade

NFR-05: banco com backups automáticos
NFR-06: retenção mínima de 12 meses (configurável)
NFR-07: tolerância a falhas (restauração rápida)

4.3 Performance

NFR-08: tempo de carregamento < 2s em telas principais
NFR-09: paginação e filtros para listas grandes

4.4 Usabilidade

NFR-10: interface responsiva (desktop + tablet)
NFR-11: fluxo rápido para auditoria em campo
NFR-12: mínimo de cliques para mudar status e preencher evidência

5. Regras de Negócio (Business Rules)

BR-01: Item “Não conforme” deve ter:

evidência obrigatória

rastreio Construflow obrigatório (ou justificativa)

próxima revisão obrigatória

BR-02: N/A exclui item do score total

BR-03: Auditoria concluída só pode ser encerrada se:

100% dos itens aplicáveis tiverem status definido
(ou permitir concluir com pendências, configurável)

BR-04: Itens do template podem ser atualizados sem alterar auditorias antigas

BR-05 (novo): Auditoria em Stand-by

Ao finalizar a verificação dos itens, a auditoria muda para Aguardando Apontamentos.

Nessa fase, a auditoria deve permitir inserir/editar apenas dados relacionados ao apontamento (Construflow) e ajustes pontuais permitidos.

BR-06 (novo): Conclusão condicionada ao Construflow

Não é permitido concluir a auditoria enquanto existirem itens “Não conforme” sem código/ID do Construflow preenchido.

BR-07 (novo): Auditoria não pode ser excluída

Auditorias não podem ser deletadas, apenas canceladas.

BR-08 (novo): Itens personalizados

Itens personalizados podem ser adicionados durante Em andamento e Aguardando Apontamentos.

Itens personalizados não alteram o checklist padrão.

6. Estrutura de Dados (resumo)

Banco recomendado: PostgreSQL (menos problema, mais robusto).

Entidades principais:

obras

fases

auditorias

disciplinas

categorias

checklist_itens (biblioteca)

auditoria_itens (instância)

itens_personalizados_auditoria (novo)

evidencias_arquivos

historico_alteracoes

relatorios (parcial/técnico/final) (novo)

usuarios

7. UX / Telas

Tela 1 — Login

acesso interno

Tela 2 — Auditorias

filtros: obra, fase, status, auditor, período

botão: Nova Auditoria

Tela 3 — Criar Auditoria

obra, fase, data início, auditor, observações

gerar itens do checklist

Tela 4 — Execução da Auditoria

lista por disciplina/categoria

item com:

status (botões rápidos)

campo evidência

link/id Construflow

próxima revisão

anexos

ação nova: “Finalizar verificação” → muda auditoria para Aguardando Apontamentos

Tela 5 — Dashboard Auditoria

score geral

score por disciplina

pendências

revisões próximas

Tela 6 — Biblioteca (Admin)

gerenciar itens do checklist

Tela 7 — Relatório

visualização e export

cards exibem auditorias:

Em andamento (relatório parcial)

Aguardando Apontamentos (relatório técnico/stand-by)

Concluída (relatório final)

8. MVP (primeira entrega)

MVP deve conter:

login + perfis básicos

obras/fases

biblioteca checklist (com aplicabilidade por fase da auditoria, se possível já no MVP)

criar auditoria (com data início)

execução por item (status + evidência + próxima revisão)

Finalizar verificação → Stand-by (novo)

vínculo manual Construflow em etapa final (novo)

dashboard simples

export Excel (PDF pode ficar para V1.1)

9. Roadmap sugerido

Sprint 1

base do projeto

banco + autenticação

CRUD obras/fases

CRUD biblioteca checklist

Sprint 2

criação de auditoria

geração de auditoria_itens

execução (status/evidência)

stand-by (Aguardando Apontamentos) + vínculo Construflow (novo)

Sprint 3

pontuação + dashboard

export XLSX

Sprint 4

anexos

relatório PDF

histórico de alterações

itens personalizados (se não estiver no sprint anterior)

10. Critérios de Aceite

Criar auditoria com data início e checklist completo

Preencher 100 itens sem lentidão

Finalizar verificação e auditoria ir para Aguardando Apontamentos

Não permitir concluir auditoria se houver NC sem código Construflow

Exportar relatório XLSX com:

todos itens

status

evidências

Construflow

próxima revisão

score final

Histórico registra alteração de status e evidência

Auditoria não pode ser excluída (apenas cancelada)

Permitir adicionar item personalizado durante execução/stand-by

11. Riscos e Mitigações

Risco: mudança de checklist no meio de auditorias
Mitigação: template versionado + auditoria_itens independente

Risco: anexos pesados
Mitigação: limitar tamanho, compressão, armazenamento S3

Risco: baixa adoção (saudade da planilha)
Mitigação: export Excel + UX rápida + filtros

12. Recomendações técnicas (Cursor IDE)

Como você vai usar o Cursor, recomendo estruturar assim:

apps/web (Next.js)

apps/api (Nest)

packages/shared (tipos/validações)

infra/ (docker-compose, scripts)

Banco:

PostgreSQL

Supabase

migrations Prisma