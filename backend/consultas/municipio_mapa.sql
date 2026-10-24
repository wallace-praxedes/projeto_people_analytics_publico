WITH cidades (municipio, codigo_uf) AS (
    VALUES
        ('São Paulo', 35),
        ('Rio de Janeiro', 33),
        ('Porto Alegre', 43),
        ('Curitiba', 41),
        ('Fortaleza', 23),
        ('Brasília', 53),
        ('Campinas', 35),
        ('Recife', 26),
        ('Salvador', 29),
        ('Belo Horizonte', 31),
        ('Florianópolis', 42),
        ('Osasco', 35),
        ('São Bernardo do Campo', 35),
        ('Guarulhos', 35),
        ('Cuiabá', 51),
        ('Ribeirão Preto', 35),
        ('Sorocaba', 35),
        ('Uberlândia', 31),
        ('Belém', 15),
        ('Campo Grande', 50),
        ('Santos', 35),
        ('Goiânia', 52),
        ('Juiz de Fora', 31),
        ('Niterói', 33),
        ('Santo André', 35),
        ('Aracaju', 28),
        ('João Pessoa', 25),
        ('Natal', 24),
        ('São Luís', 21),
        ('Feira de Santana', 29),
        ('Londrina', 41),
        ('Maceió', 27),
        ('Manaus', 13)
)
SELECT
    e.municipio_nascimento AS municipio,
    r.latitude,
    r.longitude,
    COUNT(*) AS quantidade
FROM vw_empregados e
JOIN cidades c
    ON c.municipio = e.municipio_nascimento
JOIN ref_municipios r
    ON r.nome = c.municipio
   AND r.codigo_uf = c.codigo_uf
WHERE e.status_empregado = 'Ativo'
GROUP BY e.municipio_nascimento, r.latitude, r.longitude
ORDER BY quantidade DESC, municipio;