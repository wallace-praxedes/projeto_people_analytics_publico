SELECT
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE LEFT(UPPER(sexo), 1) = 'F') / NULLIF(COUNT(*), 0),
        1
    ) AS valor,
    '%' AS unidade
FROM vw_empregados
WHERE status_empregado = 'Ativo'
  AND categoria_gerencia = 'GERENTE';