# Templates

## Pós-Venda LLC

O template para geração do PDF Pós-Venda LLC deve estar nesta pasta:

```
pos-venda-llc-template.docx
```

O documento deve conter placeholders no formato `<<Campo>>`, por exemplo:
- <<Empresa>>
- <<Pagamento>>
- <<Comercial>>
- <<Nº>>
- <<Tipo de negócio>>
- <<Anônimo>>
- <<Holding>>
- <<Forma de Pgto>>
- Itens 1–5 (tabela Descrição | Valor), na ordem fixa:
  - **IMPORTANTE:** O template deve ter o rótulo fixo + placeholder. O código envia apenas o conteúdo (sem rótulo).
  - #1 `LLC: <<item_1_descricao>>` → exibe "LLC: Wyoming · Gold" (o código envia só "Wyoming · Gold")
  - #2 `Endereço: <<item_2_descricao>>` → exibe "Endereço: New Mexico, 412 W 7th St · Anual" (o código envia só "New Mexico, 412 W 7th St · Anual")
  - #3 `Gateway: <<item_3_descricao>>` → exibe "Gateway: —" (o código envia "—" quando vazio)
  - #4 `Serviço Adicional: <<item_4_descricao>>` → exibe "Serviço Adicional: —"
  - #5 `Banco Tradicional: <<item_5_descricao>>` → exibe "Banco Tradicional: —"
- <<Sócio 1>> .. <<Sócio 5>>, <<Autorização 1>> .. <<Porcentagem 5>>
- <<Observação>>

Ver `docs/PDF_POS_VENDA.md` para lista completa e setup do LibreOffice.
