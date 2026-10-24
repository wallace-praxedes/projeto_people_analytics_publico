select
    case
        when centro_resultado_nome in (
            'Presidência',
            'Jurídico',
            'Recursos Humanos (People)'
        ) then 'CEO'

        when centro_resultado_nome in (
            'Financeiro e Controladoria'
        ) then 'CFO'

        when centro_resultado_nome in (
            'Engenharia de Software',
            'Dados e Analytics',
            'Infraestrutura e Segurança da Informação'
        ) then 'CTO'

        when centro_resultado_nome in (
            'Produto e Design'
        ) then 'CPO'

        when centro_resultado_nome in (
            'Operações',
            'Atendimento ao Cliente',
            'Comercial e Customer Success',
            'Marketing'
        ) then 'COO'

        else 'Sem diretoria'
    end                 as categoria,
    count(*)            as quantidade
from vw_empregados_base
where status_empregado = 'Ativo'
group by 1
order by quantidade desc;