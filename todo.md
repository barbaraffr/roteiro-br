# Project TODO - RoteiroBR

## Backend
- [x] Schema: tabela `trips` para histórico de viagens
- [x] Migration SQL gerada e aplicada
- [x] DB helpers em server/db.ts (trips CRUD)
- [x] tRPC: trips.autocomplete (Places Autocomplete restrito a Brasil)
- [x] tRPC: trips.calculate (Directions API + cálculo combustível + estimativa pedágios)
- [x] tRPC: trips.save (protectedProcedure)
- [x] tRPC: trips.list (protectedProcedure)
- [x] tRPC: trips.delete (protectedProcedure)
- [x] Testes vitest para procedures de trips

## Frontend
- [x] Design system: paleta de cores elegante, tipografia, tema
- [x] Componente: CityAutocomplete (combobox com Google Places)
- [x] Componente: TripForm (origem, destino, km/l, preço combustível)
- [x] Componente: TripResults (distância, tempo, combustível, pedágios, total)
- [x] Componente: TripMap (Google Maps com rota traçada)
- [x] Página: Home/Landing com formulário de busca
- [x] Página: History (histórico de buscas, protegido por login)
- [x] Navegação: header com login/logout e links
- [x] Integração: salvar viagem no histórico quando logado
- [x] Integração: reutilizar busca do histórico

## Polish
- [x] Estados de loading, erro e vazio
- [x] Responsividade mobile
- [x] Animações sutis
- [x] Formatação de moeda (R$) e distância (km)
