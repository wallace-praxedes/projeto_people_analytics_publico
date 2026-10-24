# Exporta um arquivo JSON para cada combinacao de filtros
# (Empresa x Centro de resultado x Gerencia), sempre com dados SOMADOS.
#
# Como funciona: para cada combinacao, o script descobre quais matriculas
# fazem parte do grupo e cria no banco tres visoes TEMPORARIAS, com os mesmos
# nomes das camadas de dados (raw_empregados, vw_empregados_base e
# vw_empregados), mostrando so essas matriculas. Como as consultas leem essas
# camadas pelo nome, elas passam a enxergar apenas o grupo, sem precisar mudar
# nenhuma delas. As visoes temporarias somem quando o script termina.

import json
import os
import re
import sys
import unicodedata
from datetime import date, datetime
from decimal import Decimal

import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

PASTA_BACKEND = os.path.dirname(os.path.abspath(__file__))
PASTA_PROJETO = os.path.dirname(PASTA_BACKEND)
PASTA_CONSULTAS = os.path.join(PASTA_BACKEND, "consultas")
PASTA_SAIDA = os.path.join(PASTA_PROJETO, "frontend", "dados", "filtros")

load_dotenv(os.path.join(PASTA_PROJETO, ".env"))

# Tamanho minimo de um grupo para mostrar os numeros dele.
# 1 = sem minimo (so esconde combinacoes sem ninguem).
# Para proteger grupos pequenos, troque por 3 ou 5.
GRUPO_MINIMO = 1

# Consultas que o painel nao usa
EXCLUIR = {"municipio_nascimento", "ativo_por_area"}

# Filtro -> coluna da visao vw_empregados
COLUNAS = {
    "empresa": "empresa_nome",
    "centro": "centro_resultado_nome",
    "gerencia": "categoria_gerencia",
}

# As tres camadas de dados que as consultas podem ler
CAMADAS_BAIXAS = ["raw_empregados", "vw_empregados_base"]
OBJETOS = CAMADAS_BAIXAS + ["vw_empregados"]

# Consultas que usam o esquema (public.) escrito ignorariam os filtros
PADRAO_ESQUEMA = re.compile(r"\bpublic\s*\.", re.IGNORECASE)
# Toda consulta precisa ler alguma das tres camadas
PADRAO_USO = re.compile(r"raw_empregados|vw_empregados", re.IGNORECASE)


def conectar():
    return psycopg2.connect(
        host="localhost",
        port=os.getenv("POSTGRES_PORT"),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


def slug(texto):
    # Transforma "Nexa Tecnologia S.A." em "nexa-tecnologia-s-a"
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", str(texto)) if unicodedata.category(c) != "Mn"
    )
    limpo = re.sub(r"[^a-zA-Z0-9]+", "-", sem_acento).strip("-").lower()
    return limpo or "item"


def valor_json(valor):
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    return valor


def ler_consultas():
    consultas = {}
    for arquivo in sorted(os.listdir(PASTA_CONSULTAS)):
        if not arquivo.lower().endswith(".sql"):
            continue
        nome = arquivo[:-4]
        if nome in EXCLUIR:
            continue
        caminho = os.path.join(PASTA_CONSULTAS, arquivo)
        with open(caminho, encoding="utf-8-sig") as f:
            consultas[nome] = f.read()
    return consultas


def checar_consultas(consultas):
    problemas = []
    for nome, texto in consultas.items():
        if PADRAO_ESQUEMA.search(texto) or not PADRAO_USO.search(texto):
            problemas.append(nome)
    if problemas:
        print("PARANDO: estas consultas usam 'public.' ou nao leem nenhuma das camadas de dados,")
        print("e por isso ignorariam os filtros:")
        for nome in problemas:
            print("  - " + nome + ".sql")
        print("Me mande o conteudo delas que eu ajusto.")
        sys.exit(1)


def descobrir_esquemas(cursor):
    esquemas = {}
    for objeto in OBJETOS:
        cursor.execute(
            sql.SQL(
                "SELECT n.nspname FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE c.relname = {nome} AND c.relkind IN ('r', 'v') "
                "AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname <> 'pg_catalog'"
            ).format(nome=sql.Literal(objeto))
        )
        linha = cursor.fetchone()
        if linha is None:
            print("PARANDO: nao achei " + objeto + " no banco.")
            sys.exit(1)
        esquemas[objeto] = linha[0]
    return esquemas


def conferir_matricula_unica(cursor, esquemas):
    cursor.execute(
        sql.SQL("SELECT COUNT(*), COUNT(DISTINCT matricula) FROM {esq}.vw_empregados").format(
            esq=sql.Identifier(esquemas["vw_empregados"])
        )
    )
    total, distintas = cursor.fetchone()
    if total != distintas:
        print("PARANDO: a matricula nao e unica (" + str(total) + " linhas, "
              + str(distintas) + " matriculas diferentes).")
        print("Me avise que eu troco a chave usada para identificar cada empregado.")
        sys.exit(1)
    print("Matriculas unicas: sim (" + str(total) + " empregados na base)")


def valores_distintos(cursor, esquemas, coluna):
    cursor.execute(
        sql.SQL(
            "SELECT DISTINCT {col} FROM {esq}.vw_empregados "
            "WHERE status_empregado = 'Ativo' AND {col} IS NOT NULL"
        ).format(col=sql.Identifier(coluna), esq=sql.Identifier(esquemas["vw_empregados"]))
    )
    valores = [linha[0] for linha in cursor.fetchall()]
    return sorted(valores, key=lambda v: str(v).casefold())


def montar_opcoes(valores):
    opcoes = []
    usados = {"todos"}
    for valor in valores:
        base = slug(valor)
        identificador = base
        n = 2
        while identificador in usados:
            identificador = base + "-" + str(n)
            n += 1
        usados.add(identificador)
        opcoes.append({"id": identificador, "nome": str(valor)})
    return opcoes


def criar_visoes_filtradas(cursor, esquemas, condicoes):
    where = sql.SQL(" AND ").join(condicoes) if condicoes else sql.SQL("TRUE")

    # Matriculas que fazem parte do grupo escolhido
    subconsulta = sql.SQL("SELECT matricula FROM {esq}.vw_empregados WHERE {w}").format(
        esq=sql.Identifier(esquemas["vw_empregados"]), w=where
    )

    # Camadas de baixo: so as linhas do grupo
    for objeto in CAMADAS_BAIXAS:
        cursor.execute(
            sql.SQL(
                "CREATE OR REPLACE TEMP VIEW {obj} AS "
                "SELECT t.* FROM {esq}.{obj} t WHERE t.matricula IN ({sub})"
            ).format(
                obj=sql.Identifier(objeto),
                esq=sql.Identifier(esquemas[objeto]),
                sub=subconsulta,
            )
        )

    # Camada de cima
    cursor.execute(
        sql.SQL(
            "CREATE OR REPLACE TEMP VIEW vw_empregados AS "
            "SELECT * FROM {esq}.vw_empregados WHERE {w}"
        ).format(esq=sql.Identifier(esquemas["vw_empregados"]), w=where)
    )
    return where


def conferir_visoes(cursor, esquemas, where):
    # Cada camada temporaria precisa ter exatamente as linhas do grupo
    cursor.execute(
        sql.SQL("SELECT COUNT(*) FROM {esq}.vw_empregados WHERE {w}").format(
            esq=sql.Identifier(esquemas["vw_empregados"]), w=where
        )
    )
    esperado = cursor.fetchone()[0]
    for objeto in OBJETOS:
        cursor.execute(sql.SQL("SELECT COUNT(*) FROM {obj}").format(obj=sql.Identifier(objeto)))
        encontrado = cursor.fetchone()[0]
        if encontrado != esperado:
            print("PARANDO: a visao temporaria de " + objeto + " nao bate com o grupo.")
            print("Esperado " + str(esperado) + " linhas, encontrado " + str(encontrado) + ".")
            sys.exit(1)


def contar_ativos(cursor):
    cursor.execute("SELECT COUNT(*) FROM vw_empregados WHERE status_empregado = 'Ativo'")
    return cursor.fetchone()[0]


def executar_consulta(cursor, texto):
    try:
        cursor.execute(texto)
        colunas = [c[0] for c in cursor.description]
        registros = [
            dict(zip(colunas, [valor_json(v) for v in linha]))
            for linha in cursor.fetchall()
        ]
    except psycopg2.Error as erro:
        return None, str(erro).strip().splitlines()[0]

    # Valor unico (ex.: media de idade): vira objeto {valor, unidade}
    if "valor" in colunas and len(registros) == 1:
        return registros[0], None
    return registros, None


def gravar_json(caminho, objeto):
    with open(caminho, "w", encoding="utf-8") as arquivo:
        json.dump(objeto, arquivo, ensure_ascii=False, separators=(",", ":"))


def preparar_pasta_saida():
    os.makedirs(PASTA_SAIDA, exist_ok=True)
    for arquivo in os.listdir(PASTA_SAIDA):
        if arquivo.lower().endswith(".json"):
            os.remove(os.path.join(PASTA_SAIDA, arquivo))


def main():
    consultas = ler_consultas()
    checar_consultas(consultas)
    print("Consultas lidas: " + str(len(consultas)))

    conexao = conectar()
    conexao.autocommit = True
    cursor = conexao.cursor()

    try:
        esquemas = descobrir_esquemas(cursor)
        conferir_matricula_unica(cursor, esquemas)

        cursor.execute("SELECT current_date")
        competencia = cursor.fetchone()[0].isoformat()

        opcoes = {
            chave: montar_opcoes(valores_distintos(cursor, esquemas, coluna))
            for chave, coluna in COLUNAS.items()
        }
        print(
            "Opcoes: "
            + str(len(opcoes["empresa"])) + " empresas, "
            + str(len(opcoes["centro"])) + " centros, "
            + str(len(opcoes["gerencia"])) + " gerencias"
        )

        preparar_pasta_saida()
        gravar_json(
            os.path.join(PASTA_SAIDA, "_opcoes.json"),
            {
                "competencia": competencia,
                "empresa": opcoes["empresa"],
                "centro": opcoes["centro"],
                "gerencia": opcoes["gerencia"],
            },
        )

        total = 0
        com_indicadores = 0
        sem_ativos = 0
        protegidos = 0
        erros = {}

        for empresa in [None] + opcoes["empresa"]:
            for centro in [None] + opcoes["centro"]:
                for gerencia in [None] + opcoes["gerencia"]:
                    escolha = {"empresa": empresa, "centro": centro, "gerencia": gerencia}
                    condicoes = [
                        sql.SQL("{} = {}").format(
                            sql.Identifier(COLUNAS[chave]), sql.Literal(item["nome"])
                        )
                        for chave, item in escolha.items()
                        if item is not None
                    ]
                    where = criar_visoes_filtradas(cursor, esquemas, condicoes)
                    conferir_visoes(cursor, esquemas, where)
                    n_ativos = contar_ativos(cursor)

                    ids = {
                        chave: (item["id"] if item is not None else "todos")
                        for chave, item in escolha.items()
                    }
                    pacote = {
                        "competencia": competencia,
                        "filtros": ids,
                        "motivo": None,
                        "indicadores": None,
                    }

                    if n_ativos == 0:
                        pacote["motivo"] = "sem_ativos"
                        sem_ativos += 1
                    elif n_ativos < GRUPO_MINIMO:
                        pacote["motivo"] = "grupo_pequeno"
                        protegidos += 1
                    else:
                        indicadores = {}
                        for nome, texto in consultas.items():
                            dados, erro = executar_consulta(cursor, texto)
                            if erro is not None:
                                erros[nome] = erro
                            indicadores[nome] = dados
                        pacote["indicadores"] = indicadores
                        com_indicadores += 1

                    nome_arquivo = ids["empresa"] + "__" + ids["centro"] + "__" + ids["gerencia"]
                    gravar_json(os.path.join(PASTA_SAIDA, nome_arquivo + ".json"), pacote)
                    total += 1

                    if total % 25 == 0:
                        print("  ... " + str(total) + " combinacoes")

        print("")
        print("Competencia: " + competencia)
        print("Gerados: " + str(total) + " pacotes em frontend\\dados\\filtros")
        print(
            "Com indicadores: " + str(com_indicadores)
            + " | sem ativos: " + str(sem_ativos)
            + " | protegidos: " + str(protegidos)
        )
        if erros:
            print("Consultas com erro em alguma combinacao (ficam vazias no painel):")
            for nome, erro in erros.items():
                print("  - " + nome + ": " + erro)
        else:
            print("Consultas com erro: nenhuma")
    finally:
        cursor.close()
        conexao.close()


if __name__ == "__main__":
    main()