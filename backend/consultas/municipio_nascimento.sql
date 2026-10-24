SELECT
    count(*)                as quantidade,
    municipio_nascimento    as categoria
from vw_empregados_base
where status_empregado = 'Ativo'
GROUP BY municipio_nascimento
ORDER BY quantidade DESC, municipio_nascimento
LIMIT 10;