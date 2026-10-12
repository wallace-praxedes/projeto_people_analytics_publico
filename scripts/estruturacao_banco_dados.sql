-- =======================================================================
-- BLOCO 1: Estruturação da tabela para as informações brutas
-- =======================================================================
drop table if exists raw_empregados;

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
salario_bruto				numeric(10,2),
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
drop table if exists stg_empregados;

CREATE TABLE stg_empregados(
matricula					text,
nome						text,
sexo						text,
funcao_nome					text,
data_nascimento				text,
centro_resultado_codigo		text,
centro_resultado_nome		text,
data_admissao				text,
data_desligamento			text,
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
-- BLOCO 5: conferencia de dados na tabela raw_empregados
-- =======================================================================
	
select * from raw_empregados limit 10;

select 	count (*) 													as total,
		count (*) filter (where data_desligamento is not null) 		as desligados,
		count (*) filter (where data_desligamento is null) 			as ativos
from raw_empregados;

select column_name, data_type
from information_schema.columns 
where table_name = 'raw_empregados'
order by ordinal_position;