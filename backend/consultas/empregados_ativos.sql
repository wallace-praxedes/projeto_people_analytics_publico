select
	count(*)			as valor,
	'empregados'		as unidade
from 	vw_empregados_base
where 	status_empregado = 'Ativo';