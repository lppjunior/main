# Imóveis Caixa

Aplicação local para consultar a lista de imóveis disponibilizada pela Caixa. A
aplicação lê `lista_imoveis_geral.csv` no diretório do projeto sempre que a
página é aberta ou recarregada. Se ele não existir, a lista é baixada uma vez da
Caixa, validada e salva nesse local. Um arquivo já existente não é substituído ou
atualizado automaticamente. Também é reconhecido o nome `Lista_imoveis_geral.csv`.
A área de filtros está reservada para implementação futura.

## Executar

É necessário ter Node.js 20 ou superior instalado. No diretório do projeto, execute:

```powershell
npm install
npm start
```

Abra <http://localhost:8000>. Para encerrar, pressione `Ctrl+C` no terminal.
É necessário acesso à internet para baixar o CSV ausente e para consultar a
base de alertas históricos. Se um download falhar, uma próxima consulta poderá
tentar novamente. Caso o CSV local esteja inválido ou inacessível, corrija ou
substitua o arquivo; ele não será sobrescrito automaticamente.

Para atualizar a lista, substitua manualmente o CSV local por uma versão válida
ou remova-o para permitir um novo download. Downloads simultâneos usam um
arquivo de bloqueio temporário; se o processo for interrompido durante o
download e uma consulta indicar que o bloqueio permaneceu, confirme que não há
outro download em andamento antes de remover `lista_imoveis_geral.csv.lock`.

## Alertas históricos

A página sinaliza imóveis cujo bairro, conforme informado pela Caixa, coincide
com bairro da cidade do Rio de Janeiro em que alguma área foi atribuída a
grupos armados no mapa histórico de 2022. O cruzamento usa o nome exato do bairro,
ignorando diferenças de maiúsculas, acentos e espaços. Não identifica em qual
parte do bairro está o imóvel: **o alerta não confirma domínio no endereço nem
a situação atual**. Todos os demais endereços permanecem não avaliados; ausência
de alerta não significa segurança. A fonte não cobre todo o Brasil e não avalia
restrições legais ou urbanísticas.

Na tabela, os imóveis com alerta histórico aparecem em vermelho claro. O botão
“Ver motivo” apresenta os dados do bairro e as limitações do alerta.

Os percentuais correspondem à parcela da área total do bairro atribuída a cada
grupo, não à probabilidade de risco. A malha é baseada no Censo 2010 e nomes ou
limites podem divergir dos usados pela Caixa. O ano de 2022 é o mais recente da
base derivada utilizada, que foi fixada em uma versão para permitir reprodução.
O [estudo mais recente do GENI/UFF e Fogo Cruzado](https://geni.uff.br/2025/12/04/atualizacao-do-mapa-historico-dos-grupos-armados-2/)
usa dados de 2024, mas seus polígonos não estão integrados à aplicação.

Para gerar ou atualizar o arquivo `lista_alertas_historicos.csv` com a lista
local da Caixa:

```powershell
npm run alertas
```

O arquivo é um retrato da data indicada nele e não é atualizado ao abrir a
página. Fonte dos indicadores: [base derivada por bairro](https://github.com/olucasandre/mapa-faccoes-rio-bairros),
elaborada a partir do mapa do Fogo Cruzado e da malha do IBGE. Os dados mantêm
os termos das respectivas fontes originais.

## Testes

```powershell
npm test
```

Fonte: [lista de imóveis da Caixa](https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv).
