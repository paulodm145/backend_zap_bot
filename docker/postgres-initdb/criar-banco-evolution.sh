#!/bin/sh
# Executado automaticamente pela imagem oficial do Postgres apenas na
# primeira inicialização do volume (diretório de dados vazio). Cria o banco
# dedicado da Evolution API no mesmo servidor Postgres do ambiente local,
# evitando subir um segundo container de banco só para isso.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE zapbot_evolution'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zapbot_evolution')\gexec
EOSQL
