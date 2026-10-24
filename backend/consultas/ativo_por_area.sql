SELECT
    count (*)               AS  quantidade,
    centro_resultado_nome   AS categoria
from vw_empregados_base
where status_empregado = 'Ativo'
GROUP BY centro_resultado_nome
ORDER BY quantidade DESC;