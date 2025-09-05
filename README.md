# Painel de Contratações da UFR

Aplicação React de página única para visualizar o Plano de Contratações Anual (PCA) da UFR.

## Uso
1. Faça build com seu bundler favorito (ex.: Vite) e sirva `index.html`.
2. O painel possui dois modos de dados:
   - **DEMO**: usa dados fictícios e funciona offline.
   - **LIVE**: consulta a API pública do PNCP.

## Consulta ao PNCP
A API base é `https://pncp.gov.br/pncp-consulta`. As datas devem ser informadas no formato `AAAAmmdd`.
A documentação dos endpoints pode ser explorada no [Swagger do PNCP](https://pncp.gov.br/api/consulta/swagger-ui/index.html).

Exemplo de chamada:
```
https://pncp.gov.br/pncp-consulta/v1/contratos?dataInicial=20240101&dataFinal=20240131&pagina=1&tamanhoPagina=10
```
No painel, ajuste o UASG e o ano conforme necessário e altere o modo para **LIVE** para usar a API.

## Desenvolvimento
O componente principal está em `App.jsx` e funções utilitárias em `csv.js`.

### Testes
Execute:
```
npm test
```
