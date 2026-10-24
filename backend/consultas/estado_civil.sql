SELECT
	CASE
		WHEN estado_civil in ('Solteiro', 'Solteira') 		then 'Solteiro (a)'
		when estado_civil in ('Casado', 'Casada')			then 'Casado (a)'
		when estado_civil in ('Divorciado', 'Divorciada')	then 'Divorciado (a)'
		when estado_civil in ('Viúvo', 'Viúva')				then 'Viúvo (a)'
		else estado_civil
	end			as categoria,
	count(*)	as quantidade
from vw_empregados_base
where status_empregado = 'Ativo'
group by 1
ORDER BY quantidade desc;