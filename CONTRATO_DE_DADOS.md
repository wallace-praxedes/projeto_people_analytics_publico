# CONTRATO DE DADOS

Este documento define os indicadores do painel e o formato exato de cada arquivo JSON. O backend grava os arquivos em `frontend/dados/` e o frontend lê apenas esses arquivos.

## Regras gerais

- Todo JSON tem a mesma moldura: `indicador`, `competencia` e `dados`. Só o conteúdo de `dados` muda.
- `competencia` traz a data do dia em que o backend rodou (`current_date`, lida do próprio banco). Todos os arquivos da mesma rodada têm a mesma data.
- Nomes de campos sem acento e sem espaço (ex.: `faixa_etaria`).
- O SQL já entrega as linhas ordenadas (barras do maior para o menor; evolução em ordem de mês).
- O backend só devolve dados agregados, nunca a lista de pessoas.
- Fonte padrão: `vw_empregados_base`, com `status_empregado = 'Ativo'`.

## Modelos de JSON

### Modelo 1: categoria + quantidade

```json
{
  "indicador": "estado_civil",
  "competencia": "2026-10-22",
  "dados": [
    { "categoria": "Solteiro", "quantidade": 110 },
    { "categoria": "Casado", "quantidade": 95 },
    { "categoria": "Divorciado", "quantidade": 20 }
  ]
}
```

### Modelo 2: valor único

```json
{
  "indicador": "tempo_medio_casa",
  "competencia": "2026-10-22",
  "dados": { "valor": 3.4, "unidade": "anos" }
}
```

### Modelo 3: mês + quantidade

```json
{
  "indicador": "evolucao_mensal",
  "competencia": "2026-10-22",
  "dados": [
    { "mes": "2026-08", "quantidade": 231 },
    { "mes": "2026-09", "quantidade": 228 },
    { "mes": "2026-10", "quantidade": 225 }
  ]
}
```

### Modelo 4: faixa etária + sexo + quantidade

```json
{
  "indicador": "piramide_etaria",
  "competencia": "2026-10-22",
  "dados": [
    { "faixa_etaria": "20-29", "sexo": "Masculino", "quantidade": 30 },
    { "faixa_etaria": "20-29", "sexo": "Feminino", "quantidade": 28 },
    { "faixa_etaria": "30-39", "sexo": "Masculino", "quantidade": 45 },
    { "faixa_etaria": "30-39", "sexo": "Feminino", "quantidade": 35 }
  ]
}
```

### Modelo 5: categoria + líderes + total

```json
{
  "indicador": "lideranca_por_area",
  "competencia": "2026-10-22",
  "dados": [
    { "categoria": "Engenharia de Software", "lideres": 6, "total": 52 },
    { "categoria": "Financeiro e Controladoria", "lideres": 3, "total": 18 }
  ]
}
```

(Todos os números acima são ilustrativos.)

---

**Indicador:** piramide_etaria
- **Pergunta que responde:** como os empregados ativos se distribuem por geração e sexo?
- **Fonte:** vw_empregados_base, com status_empregado = 'Ativo'
- **Arquivo:** frontend/dados/piramide_etaria.json
- **Consulta:** backend/consultas/piramide_etaria.sql
- **Formato:** Modelo 4 (faixa_etaria traz o nome da geração)
- **Gráfico:** pirâmide etária
- **Atenção:** geração sem pessoas de um dos sexos não gera linha; o painel trata a ausência como zero.

**Indicador:** evolucao_mensal
- **Pergunta que responde:** quantos empregados ativos havia no final de cada mês?
- **Fonte:** vw_empregados_base, com generate_series do mês da primeira admissão até o mês atual (conta quem foi admitido até o fim do mês e não saiu antes dele; não usa status_empregado)
- **Arquivo:** frontend/dados/evolucao_mensal.json
- **Consulta:** backend/consultas/evolucao_mensal.sql
- **Formato:** Modelo 3
- **Gráfico:** linha

**Indicador:** tempo_medio_casa
- **Pergunta que responde:** qual o tempo médio de casa, em anos, dos empregados ativos?
- **Fonte:** vw_empregados, com status_empregado = 'Ativo'
- **Arquivo:** frontend/dados/tempo_medio_casa.json
- **Consulta:** backend/consultas/tempo_medio_casa.sql
- **Formato:** Modelo 2 (`"unidade": "anos"`)
- **Gráfico:** cartão
- **Atenção:** o valor está em anos, não em meses.

**Indicador:** ativo_por_diretoria
- **Pergunta que responde:** quantos empregados ativos há em cada diretoria?
- **Fonte:** vw_empregados_base, com status_empregado = 'Ativo' (diretoria definida por um case sobre centro_resultado_nome)
- **Arquivo:** frontend/dados/ativo_por_diretoria.json
- **Consulta:** backend/consultas/ativo_por_diretoria.sql
- **Formato:** Modelo 1 (CEO, CFO, CTO, CPO, COO)
- **Gráfico:** rosca ou barra

**Indicador:** lideranca_por_area
- **Pergunta que responde:** qual a proporção de líderes entre os empregados ativos de cada área?
- **Fonte:** vw_empregados, com status_empregado = 'Ativo' e categoria_gerencia = 'GERENTE'
- **Arquivo:** frontend/dados/lideranca_por_area.json
- **Consulta:** backend/consultas/lideranca_por_area.sql
- **Formato:** Modelo 5 (o painel calcula líderes ÷ total)
- **Gráfico:** barra horizontal
- **Regra de liderança:** vem da visão (Chief, Coordenador, Diretor, Gerente e Supervisor). Chefe de Gabinete e Tech Lead não contam.

**Indicador:** municipio_nascimento
- **Pergunta que responde:** quais são os 10 municípios de nascimento mais frequentes entre os empregados ativos?
- **Fonte:** vw_empregados_base, com status_empregado = 'Ativo'
- **Arquivo:** frontend/dados/municipio_nascimento.json
- **Consulta:** backend/consultas/municipio_nascimento.sql
- **Formato:** Modelo 1 (10 linhas, do maior para o menor; empates desempatados em ordem alfabética)
- **Gráfico:** barra horizontal (plano B do mapa de densidade)
- **Atenção:** o dado é o município de nascimento, não o de residência.