SELECT
    categoria_gerencia AS nivel_hierarquico,
    formacao_academica,
    COUNT(*) AS quantidade
FROM vw_empregados
WHERE status_empregado = 'Ativo'
GROUP BY categoria_gerencia, formacao_academica
ORDER BY categoria_gerencia, formacao_academica;