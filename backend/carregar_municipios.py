# Carrega a lista de municipios (codigo, nome, latitude, longitude, UF)
# do arquivo backend/referencias/municipios.csv para a tabela ref_municipios.
# E uma tabela de REFERENCIA: nao contem nenhum dado de empregado.

import csv
import os

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

PASTA_BACKEND = os.path.dirname(os.path.abspath(__file__))
PASTA_PROJETO = os.path.dirname(PASTA_BACKEND)
CAMINHO_CSV = os.path.join(PASTA_BACKEND, "referencias", "municipios.csv")

load_dotenv(os.path.join(PASTA_PROJETO, ".env"))


def conectar():
    return psycopg2.connect(
        host="localhost",
        port=os.getenv("POSTGRES_PORT"),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


def ler_csv():
    linhas = []
    with open(CAMINHO_CSV, encoding="utf-8-sig", newline="") as arquivo:
        for registro in csv.DictReader(arquivo):
            linhas.append((
                int(registro["codigo_ibge"]),
                registro["nome"],
                float(registro["latitude"]),
                float(registro["longitude"]),
                int(registro["codigo_uf"]),
            ))
    return linhas


def main():
    linhas = ler_csv()

    conexao = conectar()
    try:
        with conexao:
            with conexao.cursor() as cursor:
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ref_municipios (
                        codigo_ibge INTEGER PRIMARY KEY,
                        nome        TEXT NOT NULL,
                        latitude    DOUBLE PRECISION NOT NULL,
                        longitude   DOUBLE PRECISION NOT NULL,
                        codigo_uf   INTEGER NOT NULL
                    )
                    """
                )
                cursor.execute("TRUNCATE ref_municipios")
                execute_values(
                    cursor,
                    "INSERT INTO ref_municipios (codigo_ibge, nome, latitude, longitude, codigo_uf) VALUES %s",
                    linhas,
                )
                cursor.execute("SELECT COUNT(*) FROM ref_municipios")
                total = cursor.fetchone()[0]
    finally:
        conexao.close()

    print("Carregados " + str(total) + " municipios em ref_municipios.")


if __name__ == "__main__":
    main()