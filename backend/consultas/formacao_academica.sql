SELECT
    count(*)            as quantidade,
    formacao_academica  as categoria
from vw_empregados_base
WHERE status_empregado = 'Ativo'
GROUP BY formacao_academica
ORDER BY quantidade DESC;