drop view if exists vw_empregados;
drop view if exists vw_empregados_base;
drop table if exists raw_empregados;
drop table if exists stg_empregados;

-- =======================================================================
-- BLOCO 1: Estruturação da tabela para as informações brutas
-- =======================================================================

CREATE TABLE raw_empregados (
matricula					text,
nome						text,
sexo						text,
funcao_nome					text,
data_nascimento				date,
centro_resultado_nome		text,
centro_resultado_codigo		text,
data_admissao				date,
data_desligamento			date,
salario_bruto				numeric(12,2),
estado_civil				text,
raca_cor					text,
formacao_academica			text,
municipio_nascimento		text,
vinculo_empregaticio		text,
deficiente					bool,
carga_horaria_mensal		int,
empresa_nome				text,
empresa_codigo				text,
motivo_desligamento			text
);

-- =======================================================================
-- BLOCO 2: Criação da tabela de triagem
-- =======================================================================

CREATE TABLE stg_empregados(
matricula					text,
nome						text,
sexo						text,
funcao_nome					text,
centro_resultado_codigo		text,
centro_resultado_nome		text,
data_admissao				text,
data_desligamento			text,
data_nascimento				text,
salario						text,
idade						text,
estado_civil				text,
raca_cor					text,
formacao_academica			text,
municipio					text,
vinculo_empregaticio		text,
deficiente 					text,
carga_horas_mensal			text,
empresa_razao_social		text,
empresa_codigo				text,
motivo_desligamento			text
);

-- =======================================================================
-- BLOCO 3: Carrega o CSV na tabela da triagem
-- =======================================================================

copy stg_empregados
from '/dados/relacao_empregados.csv'
with (format csv, delimiter ';', header true, encoding 'UTF8');

-- =======================================================================
-- BLOCO 4: converte e move os dados de stag para raw
-- =======================================================================

insert into raw_empregados (
	matricula, nome, sexo, funcao_nome, data_nascimento, 
	centro_resultado_codigo, centro_resultado_nome, data_admissao, 
	data_desligamento, salario_bruto, estado_civil, raca_cor,
	formacao_academica, municipio_nascimento, vinculo_empregaticio,
	deficiente, carga_horaria_mensal, empresa_nome,
	empresa_codigo, motivo_desligamento
	)

select
	matricula,
	nome,
	sexo,
	funcao_nome,
	to_date(nullif(data_nascimento, ''), 'DD/MM/YYYY'),
	centro_resultado_codigo,
	centro_resultado_nome,
	to_date(nullif(data_admissao,''), 'DD/MM/YYYY'),
	to_date(nullif(data_desligamento,''), 'DD/MM/YYYY'),
	replace(salario, ',', '.')::numeric(12,2),
	estado_civil,
	raca_cor,
	formacao_academica,
	municipio,
	vinculo_empregaticio,
	(deficiente ='Sim'),
	carga_horas_mensal::int,
	empresa_razao_social,
	empresa_codigo,
	motivo_desligamento
from stg_empregados;

-- =======================================================================
-- BLOCO 5: criar tabela ajustada com cargos e idade
-- =======================================================================

create view vw_empregados_base as
select
	e.matricula,
	e.nome,
	e.sexo,
	e.funcao_nome,
	case
		when e.funcao_nome ilike 'Advogad%' 	then 'ADVOGADO (A)'
		when e.funcao_nome ilike 'Analista%'	then 'ANALISTA'
		when e.funcao_nome ilike 'Assistente%'	then 'ASSISTENTE'
		when e.funcao_nome ilike 'Atendente%'	then 'ATENDENTE'
		when e.funcao_nome ilike 'Chefe%'		then 'CHEFE'
		when e.funcao_nome ilike 'Chief%'		then 'CHIEF'
		when e.funcao_nome ilike 'Cientista%'	then 'CIENTISTA'
		when e.funcao_nome ilike 'Contador%'	then 'CONTADOR (A)'
		when e.funcao_nome ilike 'Coordenador%'	then 'COORDENADOR (A)'
		when e.funcao_nome ilike 'Design%'		then 'DESIGNER'
		when e.funcao_nome ilike 'Diretor%'		then 'DIRETOR (A)'
		when e.funcao_nome ilike 'Engenheir%'	then 'ENGENHEIRO (A)'
		when e.funcao_nome ilike 'Estagi%'		then 'ESTAGIARIO (A)'
		when e.funcao_nome ilike 'Executi%'		then 'EXECUTIVO (A)'
		when e.funcao_nome ilike 'Gerent%'		then 'GERENTE'
		when e.funcao_nome ilike 'HR B%'		then 'BUSINESS PARTNER'
		when e.funcao_nome ilike 'Jovem%'		then 'JOVEM APRENDIZ'
		when e.funcao_nome ilike 'Product%'		then 'PRODUCT EMPLOYEE'
		when e.funcao_nome ilike 'SDR'			then 'SDR'
		when e.funcao_nome ilike 'Supervisor%'	then 'SUPERVISOR (A)'
		when e.funcao_nome ilike 'Tech%'		then 'TECH EMPLOYEE'
		when e.funcao_nome ilike '%Researcher'	then 'RESEARCHER EMPLOYEE'
	end as cargo_ajustado,
	e.data_nascimento,
	extract (year from age(current_date, e.data_nascimento))::int as idade,
	e.centro_resultado_nome,
	e.centro_resultado_codigo,
	e.data_admissao,
	e.data_desligamento,
	case
		when e.data_desligamento is null then 'Ativo'
		else 'Desligado'
	end as status_empregado,
	e.salario_bruto,
	e.estado_civil,
	e.raca_cor,
	e.formacao_academica,
	e.municipio_nascimento,
	e.vinculo_empregaticio,
	e.deficiente,
	e.carga_horaria_mensal,
	e.empresa_nome,
	e.empresa_codigo,
	e.motivo_desligamento
from raw_empregados e;

-- =======================================================================
-- BLOCO 6: criar tabela com coluna de gerencia e tempo casa
-- =======================================================================

drop view if exists vw_empregados;

create view vw_empregados as
select
	b.*,
	case
		when b.cargo_ajustado 	in ('CHIEF', 'COORDENADOR (A)', 'DIRETOR (A)', 'GERENTE', 'SUPERVISOR (A)') 	then 'GERENTE'
		when b.cargo_ajustado 	in ('ESTAGIARIO (A)') 															then 'ESTAGIARIO (A)'
		when b.cargo_ajustado	in ('JOVEM APRENDIZ')															then 'JOVEM APRENDIZ'
		else 'NÃO GERENTE'
	end as categoria_gerencia,
	extract(year from age(coalesce(b.data_desligamento, current_date), b.data_admissao))::int as tempo_casa_anos,
	(extract(year from age(coalesce(b.data_desligamento, current_date), b.data_admissao)) * 12
	+	extract(month from age(coalesce(b.data_desligamento, current_date), b.data_admissao)))::int as tempo_casa_meses
from vw_empregados_base b;
	
-- =======================================================================
-- BLOCO 7: conferencia de dados na tabela raw_empregados
-- =======================================================================
	
select * from vw_empregados limit 10;

select 	count (*) 													as total,
		count (*) filter (where data_desligamento is not null) 		as desligados,
		count (*) filter (where data_desligamento is null) 			as ativos
from raw_empregados;

select column_name, data_type
from information_schema.columns 
where table_name = 'raw_empregados'
order by ordinal_position;

-- =======================================================================
-- BLOCO 8: conferencia de respostas
-- =======================================================================

-- Quantos empregados temos no último mês de competência?

select
	count (*) filter (where data_desligamento is null) as empregados_ativos
from raw_empregados;

-- Qual é a distribuição de empregados ativos por empresa?

select
	empresa_nome,
	count (*) as empregados_ativos
from raw_empregados
where data_desligamento is null
group by
	empresa_nome
order by empregados_ativos desc;

-- Qual é a evolução mensal de empregados até o último mês de competência?

-- ainda não tem como responder

-- Qual é a distribuição de empregados ativos por centro de resultado?

select
	centro_resultado_codigo, centro_resultado_nome,
	count (*) as quantidade_empregados
from raw_empregados
where data_desligamento is null
group by centro_resultado_codigo, centro_resultado_nome
order by centro_resultado_nome desc;

-- Qual é a distribuição de empregados por diretoria?

select
	centro_resultado_nome,
	count (*) as quantidade_empregados
from raw_empregados
where data_desligamento is null
group by centro_resultado_nome
order by centro_resultado_nome desc;

-- Qual é a distruição de sexo na empresa?

select
	sexo,
	count (*) as quantidade_empregados
from raw_empregados
where data_desligamento is null
group by sexo;

-- Qual é a média de idade da empresa?

select
	round(avg(idade)) as media_idade
from vw_empregados_base
where status_empregado = 'Ativo';

-- Qual é a origem da cidade de cada empregado?

select
	municipio_nascimento,
	count (*) as qtd_empregados
from vw_empregados_base
where status_empregado = 'Ativo'
group by municipio_nascimento
order by municipio_nascimento asc;

-- Qual é a distribuição de cor de pele da empresa?

select
	raca_cor,
	count (*) as qtd_empregados
from vw_empregados_base
where status_empregado = 'Ativo'
group by raca_cor;

-- Qual é a distribuição acadêmica dos empregados?

select
	formacao_academica,
	count (*) as qtd_empregados
from vw_empregados_base
where status_empregado = 'Ativo'
group by formacao_academica;

-- Qual é a distribuição de empregado por vínculo empregatício?

select
	vinculo_empregaticio,
	count (*) as qtd_empregados
from vw_empregados_base
where status_empregado = 'Ativo'
group by vinculo_empregaticio;

-- Quantos empregados portadores de deficiência a empresa tem?

select
	case
		when deficiente = 'True' then 'PCD'
		else 'Não PCD'
	end as deficiencia,
	count (*) as qtd_empregados
from vw_empregados_base
where status_empregado = 'Ativo'
group by 1;

--  Qual é a distribuição por faixa etária (pirâmide etária)?

select
	case
		when extract(year from data_nascimento) <= 1960 then 'Baby Boomers (até 1960)'
		when extract(year from data_nascimento) between 1961 and 1980 then'Geração X (1961 até 1980)'
		when extract(year from data_nascimento) between 1981 and 1996 then 'Geração Y (1981 até 1996)'
		when extract(year from data_nascimento)	between 1997 and 2009 then 'Geração Z (1997 até 2009)'
		else 'Geração Alpha (2010 adiante)'
	end as geracao,
	count (*) as qtd_empregados
from vw_empregados_base
where status_empregado = 'Ativo'
group by geracao
order by min(data_nascimento);

-- Qual é a distribuição por estado civil?

select
	estado_civil,
	count (*) as qtd_empregados
from vw_empregados_base
group by estado_civil;

-- Qual é a distribuição por sexo em cada nível hierárquico?

select
	sexo,
	count(*) filter (where categoria_gerencia = 'GERENTE')        as gerente,
	count(*) filter (where categoria_gerencia = 'NÃO GERENTE')    as nao_gerente,
	count(*) filter (where categoria_gerencia = 'ESTAGIARIO (A)') as estagiario,
	count(*) filter (where categoria_gerencia = 'JOVEM APRENDIZ') as jovem_aprendiz,
	count(*)                                                      as total
from vw_empregados
where status_empregado = 'Ativo'
group by sexo
order by sexo;

-- Qual é a quantidade mulheres na liderança?

select
	categoria_gerencia,
	count (*)												as qtd_gerente,
	count (*) filter (where sexo = 'Feminino')				as qtd_mulheres
from vw_empregados
where status_empregado = 'Ativo'
	and categoria_gerencia = 'GERENTE'
group by categoria_gerencia;

-- Qual é o tempo médio de casa por área e por empresa?

select
	centro_resultado_nome, empresa_nome,
	round(avg(tempo_casa_meses)/12.0, 2)				as tempo_media_casa_meses
from vw_empregados
where status_empregado = 'Ativo'
group by centro_resultado_nome, empresa_nome
order by empresa_nome;


-- Qual é o grau de instrução por nível hieráquico?

select
	categoria_gerencia,
	count (*) filter (where formacao_academica = 'Doutorado')							as doutorado,
	count (*) filter (where formacao_academica = 'Ensino Médio Completo')				as ensino_medio_completo,
	count (*) filter (where formacao_academica = 'Ensino Médio Incompleto')				as ensino_medio_incompleto,
	count (*) filter (where formacao_academica = 'Mestrado')							as mestrado,
	count (*) filter (where formacao_academica = 'Pós-Graduação')						as pos_graducao,
	count (*) filter (where formacao_academica = 'Superior Completo')					as superior_completo,
	count (*) filter (where formacao_academica = 'Superior Incompleto')					as superior_incompleto
from vw_empregados
where status_empregado = 'Ativo'
group by categoria_gerencia;

-- Quantos empregados com deficiência existem por área?

select
	centro_resultado_nome,
	count (*) filter (where deficiente = 'True')
from vw_empregados
where status_empregado = 'Ativo'
group by centro_resultado_nome;

-- Qual é a proporção entre liderança e demais cargos em cada área?

select
	centro_resultado_nome,
	count (*) filter (where categoria_gerencia = 'GERENTE') 			as qtd_gerentes,
	count (*) filter (where categoria_gerencia = 'NÃO GERENTE')			as qtd_nao_gerentes,
	round(100.0 * count(*) filter (where categoria_gerencia = 'GERENTE') / count(*), 1) as pct_gerencia
from vw_empregados
where status_empregado = 'Ativo'
	and categoria_gerencia in ('GERENTE', 'NÃO GERENTE')
group by centro_resultado_nome;

	