SELECT
    COALESCE(raca_cor, 'Não informado') AS categoria,
    COUNT(*) AS quantidade
FROM vw_empregados
WHERE status_empregado = 'Ativo'
GROUP BY COALESCE(raca_cor, 'Não informado')
ORDER BY quantidade DESC, categoria;