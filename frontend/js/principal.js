// Lê um arquivo .json da pasta dados/ e devolve o conteúdo.
// É como pedir uma caixa ao almoxarifado: você diz o nome, ele entrega.
async function carregarJSON(nome) {
  const resposta = await fetch("dados/" + nome + ".json");
  if (!resposta.ok) {
    throw new Error("Não achei dados/" + nome + ".json (código " + resposta.status + ")");
  }
  return await resposta.json();
}

// TESTE: mostra o número de empregados ativos na abertura
async function testarAbertura() {
  const caixa = document.getElementById("numero-ativos");
  try {
    const json = await carregarJSON("empregados_ativos");
    caixa.textContent = json.dados.valor;
    console.log("Indicador:", json.indicador, "| Competência:", json.competencia);
  } catch (erro) {
    caixa.textContent = "erro ao carregar";
    console.error(erro);
  }
}

testarAbertura();