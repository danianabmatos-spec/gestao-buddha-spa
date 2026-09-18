-- ============================================================================
--  GRANT de leitura das UNIDADES para o usuário read-only do ERP (gestao_ro)
-- ============================================================================
--  Contexto: o app de gestão (ERP) já lê "colaboradores" e "cargos" via o
--  usuário read-only `gestao_ro`. Para provisionar acessos automaticamente
--  precisamos também da UNIDADE de cada colaborador (a relação "Unidades" que
--  aparece na ficha, ex.: "Higienópolis"). Hoje o gestao_ro NÃO tem permissão
--  nessas tabelas, por isso nem as enxerga.
--
--  Executar como SUPERUSUÁRIO (ex.: postgres), CONECTADO ao banco do RH:
--      sudo -u postgres psql -d buddha_rh
--  (ajuste o nome do banco se for diferente de "buddha_rh")
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASSO 1 — Descobrir os nomes exatos das tabelas de unidade
--   Retorna a tabela de unidades e a de junção colaborador<->unidade.
--   (No Prisma, a junção implícita costuma se chamar "_ColaboradorToUnidade".)
-- ----------------------------------------------------------------------------
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND lower(table_name) LIKE '%unidad%'
 ORDER BY table_name;

-- ----------------------------------------------------------------------------
-- PASSO 2 — Conceder SELECT (somente leitura) nas tabelas do Passo 1
--   Troque os nomes abaixo pelos que apareceram acima. Exemplos comuns:
--     - tabela de unidades:        unidades   (ou "Unidade")
--     - junção colaborador↔unidade: "_ColaboradorToUnidade"
--   Nomes com maiúsculas ou "_" no início PRECISAM de aspas duplas.
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.unidades                  TO gestao_ro;
GRANT SELECT ON public."_ColaboradorToUnidade"   TO gestao_ro;

-- ----------------------------------------------------------------------------
-- PASSO 3 — Conferir que funcionou (deve listar as tabelas concedidas)
-- ----------------------------------------------------------------------------
SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE grantee = 'gestao_ro'
 ORDER BY table_name;

-- ============================================================================
--  Observações:
--   • É SOMENTE LEITURA (SELECT). Nenhuma escrita/alteração é concedida.
--   • Precisamos apenas do NOME da unidade por colaborador (ex.: "Higienópolis")
--     e do vínculo colaborador↔unidade. Se preferir expor uma VIEW mínima em vez
--     das tabelas, também serve — basta dar SELECT nela ao gestao_ro.
--   • Se houver mais de uma tabela de unidade (ou uma "empresas" separada),
--     conceda a que contém o nome da unidade mostrado na ficha do colaborador.
-- ============================================================================
