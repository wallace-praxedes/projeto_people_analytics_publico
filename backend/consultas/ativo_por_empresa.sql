SELECT
    count(*)            as quantidade,
    empresa_nome        as categoria
from vw_empregados_base
where status_empregado = 'Ativo'
GROUP BY empresa_nome
ORDER BY quantidade desc;