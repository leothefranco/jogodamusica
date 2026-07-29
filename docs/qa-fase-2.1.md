# Guia de testes — Fase 2.1

## Status

**QA manual pendente.** Formatação, lint, typecheck, 62 testes automatizados e
build passaram em 28 de julho de 2026.

## Cenários manuais

Use um projeto Supabase de desenvolvimento e uma chave da YouTube Data API.

1. Abra um tema e acesse **Importar playlist**.
2. Gere prévia para uma playlist pública e para uma não listada.
3. Confirme paginação além de 50 itens e o teto configurado.
4. Verifique estados de pronto, já associado, duplicado, indisponível, não
   incorporável, bloqueado no Brasil e inválido.
5. Confirme que somente itens prontos são selecionáveis.
6. Desmarque itens, confirme e confira as contagens no editor.
7. Repita a importação e confirme que ajustes existentes não mudam.
8. Aguarde a expiração da prévia e confirme a revalidação.
9. Simule timeout, cota esgotada e playlist privada/inacessível.
10. Confira as modalidades suportadas com 3, 4, 8, 16 e 32 músicas ativas.
11. Navegue somente por teclado e teste as larguras 360, 768 e 1280 px.

A Fase 2.1 pode ser considerada aprovada quando esses cenários passarem sem
exposição de credenciais, erros de console ou persistência parcial inesperada.
