select
    case
        when extract(year from data_nascimento) <= 1960 then 'Baby Boomers (até 1960)'
        when extract(year from data_nascimento) between 1961 and 1980 then 'Geração X (1961 a 1980)'
        when extract(year from data_nascimento) between 1981 and 1996 then 'Geração Y (1981 a 1996)'
        when extract(year from data_nascimento) between 1997 and 2009 then 'Geração Z (1997 a 2009)'
        else 'Geração Alpha (2010 em diante)'
    end                     as faixa_etaria,
    sexo                    as sexo,
    count(*)                as quantidade
from vw_empregados_base
where status_empregado = 'Ativo'
group by 1, 2
order by min(data_nascimento), sexo;