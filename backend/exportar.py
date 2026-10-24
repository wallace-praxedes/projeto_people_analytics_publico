"""
exportar.py
"""

# --- IMPORTAÇÃO DE PACOTES ---

import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# --- DEFINICAÇÃO DE CAMINHOS DE CONSULTA NA PASTA DO PROJETO ---

RAIZ = Path(__file__).resolve().parent.parent
PASTA_CONSULTAS = RAIZ / "backend" / "consultas"
PASTA_DADOS = RAIZ / "frontend" / "dados"

# --- CONFIGURAÇÃO DE CREDENCIAIS DE CONEXÃO ---

load_dotenv(RAIZ / ".env")

CONFIG_BANCO = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": os.getenv("POSTGRES_PORT", "5432"),
    "dbname": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
}

def converter_valor(valor):
    if isinstance(valor, Decimal):
        return int(valor) if valor == valor.to_integral_value() else float(valor)
    if isinstance (valor, (date, datetime)):
        return valor.isoformat()
    return valor

def montar_dados(colunas, linhas):
    registros = [
        {coluna: converter_valor(v) for coluna, v in zip(colunas,linha)}
        for linha in linhas
    ]

    if len(registros) == 1 and "valor" in registros[0] and "unidade" in registros[0]:
        return registros[0]

    return registros

def main():
    faltando = [
        nome
        for nome in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")
        if not os.getenv(nome)
    ]
    if faltando:
        print("ERRO: variáveis ausentes no .env", ", ".join(faltando))
        sys.exit(1)

    arquivos_sql = sorted(PASTA_CONSULTAS.glob("*.sql"))
    if not arquivos_sql:
        print(f"Nenhum arquivo .sql foi encontrado em {PASTA_CONSULTAS}")
        sys.exit(1)

    PASTA_DADOS.mkdir(parents=True, exist_ok=True)

    try:
        conexao = psycopg2.connect(**CONFIG_BANCO)
    except psycopg2.OperationalError as erro:
        print("ERRO ao conectar no banco. O container do Docker está ligado?")
        print("Confira também a porta (POSTGRES_PORT) no .env.")
        print(erro)
        sys.exit(1)

    gerados = []
    com_erro = []

    with conexao:
        with conexao.cursor() as cursor:
            cursor.execute("select current_date")
            competencia = cursor.fetchone()[0].isoformat()

            for arquivo in arquivos_sql:
                nome = arquivo.stem
                texto_sql = arquivo.read_text(encoding="utf-8").strip().rstrip(";")

                if not texto_sql:
                    print(f"[PULADO] {arquivo.name}: arquivo vazio")
                    com_erro.append(nome)
                    continue

                try:
                    cursor.execute(texto_sql)
                    colunas = [c.name for c in cursor.description]
                    linhas = cursor.fetchall()
                except psycopg2.Error as erro:
                    conexao.rollback()
                    print(f"[ERRO] {arquivo.name}: {erro.pgerror or erro}")
                    com_erro.append(nome)
                    continue

                resultado = {
                    "indicador": nome,
                    "competencia": competencia,
                    "dados": montar_dados(colunas, linhas),
                }

                destino = PASTA_DADOS / f"{nome}.json"
                destino.write_text(
                    json.dumps(resultado, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )

                gerados.append(nome)
                print(f"[OK] {destino.relative_to(RAIZ)}")

    conexao.close()

    print()
    print(f"Competência: {competencia}")
    print(f"Gerados: {len(gerados)} | Com problema: {len(com_erro)}")
    if com_erro:
        print("Revisar:", ", ".join(com_erro))

if __name__ == "__main__":
    main()