/**
 * Testes básicos de regras de negócio (BR).
 * Executar com: npx tsx scripts/validate-business-rules.test.ts
 */

// BR-03: Score = (Conformes / (Total - N/A)) * 100
function calculateScore(conformes: number, total: number, na: number): number {
  const avaliados = total - na;
  if (avaliados <= 0) return 0;
  return Math.round((conformes / avaliados) * 100 * 100) / 100;
}

// BR-02: Não permite concluída se houver NC sem construflow_id
function canComplete(ncs: { construflow_id?: string | null }[]): boolean {
  return ncs.every((nc) => nc.construflow_id && String(nc.construflow_id).trim());
}

function runTests() {
  let passed = 0;
  let failed = 0;
  if (calculateScore(8, 10, 0) !== 80) {
    console.error("BR-03: esperado 80, obtido", calculateScore(8, 10, 0));
    failed++;
  } else passed++;
  if (calculateScore(5, 10, 2) !== 62.5) {
    console.error("BR-03: esperado 62.5, obtido", calculateScore(5, 10, 2));
    failed++;
  } else passed++;
  if (!canComplete([{ construflow_id: "CF-001" }, { construflow_id: "CF-002" }])) {
    console.error("BR-02: esperado true para NCs com construflow_id");
    failed++;
  } else passed++;
  if (canComplete([{ construflow_id: "CF-001" }, { construflow_id: null }])) {
    console.error("BR-02: esperado false para NC sem construflow_id");
    failed++;
  } else passed++;
  console.log(`Regras de negócio: ${passed} passaram, ${failed} falharam`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
