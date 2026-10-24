select
    centro_resultado_nome                                       as categoria,
    count(*) filter (where categoria_gerencia = 'GERENTE')      as lideres,
    count(*)                                                    as total
from vw_empregados
where status_empregado = 'Ativo'
group by centro_resultado_nome
order by total desc;