SELECT
    count (*)                       as quantidade,
    centro_resultado_nome           as categoria
from vw_empregados_base
where status_empregado = 'Ativo'
    and deficiente = TRUE
GROUP BY centro_resultado_nome 
ORDER BY quantidade DESC;
