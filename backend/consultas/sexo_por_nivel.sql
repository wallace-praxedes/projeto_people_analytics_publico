SELECT
    categoria_gerencia AS nivel_hierarquico,
    CASE
        WHEN LEFT(UPPER(sexo), 1) = 'M' THEN 'Masculino'
        WHEN LEFT(UPPER(sexo), 1) = 'F' THEN 'Feminino'
    END AS sexo,
    COUNT(*) AS quantidade
FROM vw_empregados
WHERE status_empregado = 'Ativo'
GROUP BY 1, 2
ORDER BY 1, 2;