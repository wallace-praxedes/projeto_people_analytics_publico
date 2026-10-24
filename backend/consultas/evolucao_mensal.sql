select
    to_char(m.mes, 'YYYY-MM')       as mes,
    count(e.matricula)              as quantidade
from generate_series(
        (select date_trunc('month', min(data_admissao))::date from vw_empregados_base),
        date_trunc('month', current_date)::date,
        interval '1 month'
     ) as m(mes)
left join vw_empregados_base e
    on  e.data_admissao <= (m.mes + interval '1 month' - interval '1 day')::date
    and (
            e.data_desligamento is null
         or e.data_desligamento > (m.mes + interval '1 month' - interval '1 day')::date
        )
group by m.mes
order by m.mes;