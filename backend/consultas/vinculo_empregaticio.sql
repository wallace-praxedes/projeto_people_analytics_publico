SELECT
    count(*)                as quantidade,
    vinculo_empregaticio    as categoria
from vw_empregados_base
WHERE status_empregado = 'Ativo'
GROUP BY vinculo_empregaticio
ORDER BY quantidade DESC;