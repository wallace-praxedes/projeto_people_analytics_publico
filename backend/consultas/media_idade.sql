SELECT
    ROUND(AVG(idade)::numeric, 1) AS valor,
    'anos' AS unidade
FROM vw_empregados
WHERE status_empregado = 'Ativo';