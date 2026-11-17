# Imóveis Caixa

Aplicação local para consultar a lista de imóveis disponibilizada pela Caixa. A
aplicação lê `lista_imoveis_geral.csv` no diretório do projeto sempre que a
página é aberta ou recarregada. Se ele não existir, a lista é baixada uma vez da
Caixa, validada e salva nesse local. Um arquivo já existente não é substituído ou
atualizado automaticamente. Também é reconhecido o nome `Lista_imoveis_geral.csv`.
Os resultados podem ser filtrados e apresentados em lista ou cartões.

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
O botão **Sincronizar** apenas relê o CSV local e não baixa a lista da Caixa
se o arquivo estiver ausente.

## Filtros e ranking

Os filtros permitem pesquisar por texto, UF, cidade, bairro, tipo, modalidade,
preço, desconto, quartos e financiamento. O tipo, o número de quartos e a área
são extraídos da descrição fornecida pela Caixa; quando não informados, não são
estimados. A área exibida usa a área privativa, total ou do terreno, nessa ordem.
Filtros nomeados são salvos no navegador.

Nos filtros de UF, cidade e bairro, selecione uma ou várias opções. Os valores
selecionados no mesmo filtro são combinados com “ou”; filtros diferentes são
combinados com “e”. Cidades e bairros disponíveis dependem das UFs e cidades
escolhidas; cada cidade é identificada pela UF e cada bairro pela UF e cidade,
permitindo selecionar nomes iguais em localidades diferentes separadamente.
Seleções que deixam de estar disponíveis são removidas. Use a busca
em cada menu para encontrar opções, ou o campo **Bairro contém** para buscar
parte do nome. Esse campo também é combinado com os bairros selecionados.

O Top 20 apresenta os imóveis com maiores descontos dentre os resultados
filtrados; não é uma avaliação de custo-benefício ou recomendação de compra.

## Detalhes e mapa

Clique em um imóvel ou em **Ver imóvel** para abrir seus dados completos e um
mapa. O CSV da Caixa não inclui fotos: o popup informa essa limitação e oferece
um link para o anúncio oficial, onde elas podem ser consultadas.

A localização é consultada somente ao abrir um imóvel, enviando o endereço
público do CSV ao serviço [Nominatim do OpenStreetMap](https://nominatim.openstreetmap.org/).
O resultado é aproximado e pode não corresponder ao imóvel: confira o endereço
e a localização antes de tomar qualquer decisão. Se não houver resultado ou
ocorrer um erro, isso é informado no popup. O mapa usa dados e imagens do
[OpenStreetMap](https://www.openstreetmap.org/copyright).

As consultas são serializadas, limitadas a menos de uma por segundo e mantidas
em cache enquanto o servidor estiver ligado. O serviço público destina-se a
uso moderado, não a consultas em massa; os limites se aplicam a toda a
aplicação. Consulte a [política de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/).
A aplicação é destinada ao uso local por um único processo; instalações com
vários processos ou usuários devem coordenar o limite global e configurar um
serviço adequado. É possível definir `NOMINATIM_URL` antes de iniciar o servidor
para usar outro endpoint compatível com a API de busca do Nominatim. O mapa e
a localização requerem acesso à internet.

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
O filtro para ocultá-los remove apenas correspondências dessa base histórica;
não identifica todos os imóveis arriscados e fica indisponível se a base falhar.

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
