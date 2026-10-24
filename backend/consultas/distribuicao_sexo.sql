select
	sexo		as categoria,
	count(*)	as quantidade
from vw_empregados_base
where status_empregado = 'Ativo'
group by sexo
order by quantidade desc;