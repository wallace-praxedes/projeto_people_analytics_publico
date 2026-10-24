select
    round(avg(tempo_casa_anos)::numeric, 1)     as valor,
    'anos'                                      as unidade
from vw_empregados
where status_empregado = 'Ativo';