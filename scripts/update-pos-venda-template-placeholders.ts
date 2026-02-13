#!/usr/bin/env npx tsx
/**
 * Atualiza o template DOCX com placeholders normalizados (sem emojis/espaços/acentos).
 * Executar: npx tsx scripts/update-pos-venda-template-placeholders.ts
 */

import PizZip from "pizzip";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/assets/templates/pos-venda-llc-template.docx"
);

// Mapeamento: texto antigo (como no XML, com &lt;&lt; e &gt;&gt;) -> novo placeholder
const REPLACEMENTS: [string, string][] = [
  ["&lt;&lt;🏢 Empresa&gt;&gt;", "&lt;&lt;empresa&gt;&gt;"],
  ["&lt;&lt;Nº&gt;&gt;", "&lt;&lt;codigo_cliente&gt;&gt;"],
  ["&lt;&lt;📆 Pagamento&gt;&gt;", "&lt;&lt;data_pagamento&gt;&gt;"],
  ["&lt;&lt;🏳️ Idioma&gt;&gt;", "&lt;&lt;idioma&gt;&gt;"],
  ["&lt;&lt;👤 Comercial&gt;&gt;", "&lt;&lt;comercial&gt;&gt;"],
  ["&lt;&lt;🏢 Tipo de negócio&gt;&gt;", "&lt;&lt;tipo_negocio&gt;&gt;"],
  ["&lt;&lt;🥷 Anônimo&gt;&gt;", "&lt;&lt;flag_anonimo&gt;&gt;"],
  ["&lt;&lt;🏣 Holding&gt;&gt;", "&lt;&lt;flag_holding&gt;&gt;"],
  ["&lt;&lt;💳 Forma de Pgto&gt;&gt;", "&lt;&lt;pagamento_via&gt;&gt;"],
  ["&lt;&lt;✏️ Observação&gt;&gt;", "&lt;&lt;observacao&gt;&gt;"],
  // Itens 1-5
  ["LLC &lt;&lt;🛒 Pacote&gt;&gt;", "&lt;&lt;item_1_tipo&gt;&gt; &lt;&lt;item_1_descricao&gt;&gt;"],
  ["&lt;&lt;🇺🇸 LLC&gt;&gt;, &lt;&lt;🛒 Pacote&gt;&gt;", "&lt;&lt;item_1_tipo&gt;&gt;, &lt;&lt;item_1_descricao&gt;&gt;"],
  ["&lt;&lt;🇺🇸 LLC&gt;&gt;", "&lt;&lt;item_1_tipo&gt;&gt;"],
  ["&lt;&lt;🛒 Pacote&gt;&gt;", "&lt;&lt;item_1_descricao&gt;&gt;"],
  ["&lt;&lt;🧾 Valor LLC&gt;&gt;", "&lt;&lt;item_1_valor&gt;&gt;"],
  ["&lt;&lt;🛒 Endereço&gt;&gt;, &lt;&lt;📈 Modalidade&gt;&gt;", "&lt;&lt;item_2_tipo&gt;&gt;, &lt;&lt;item_2_descricao&gt;&gt;"],
  ["&lt;&lt;🛒 Endereço&gt;&gt;", "&lt;&lt;item_2_tipo&gt;&gt;"],
  ["&lt;&lt;📈 Modalidade&gt;&gt;", "&lt;&lt;item_2_descricao&gt;&gt;"],
  ["&lt;&lt;🧾 Valor Endereço&gt;&gt;", "&lt;&lt;item_2_valor&gt;&gt;"],
  ["&lt;&lt;🛒 Gateway&gt;&gt;", "&lt;&lt;item_3_descricao&gt;&gt;"],
  ["&lt;&lt;🧾 Valor Gateway&gt;&gt;", "&lt;&lt;item_3_valor&gt;&gt;"],
  ["&lt;&lt;🛒 Serv. Adicional&gt;&gt;", "&lt;&lt;item_4_descricao&gt;&gt;"],
  ["&lt;&lt;🧾 Valor Serv. Adicional&gt;&gt;", "&lt;&lt;item_4_valor&gt;&gt;"],
  ["&lt;&lt;🛒 Banco Tradicional&gt;&gt;", "&lt;&lt;item_5_descricao&gt;&gt;"],
  ["&lt;&lt;🧾 Valor B. Tradicional&gt;&gt;", "&lt;&lt;item_5_valor&gt;&gt;"],
  // Sócios 1-5
  ["&lt;&lt;👔 Sócio(a) principal&gt;&gt;", "&lt;&lt;socio_1_nome&gt;&gt;"],
  ["&lt;&lt;👨‍💼 Autorização 1&gt;&gt;", "&lt;&lt;socio_1_papel&gt;&gt;"],
  ["&lt;&lt;⚖️ Porcentagem 1&gt;&gt;", "&lt;&lt;socio_1_pct&gt;&gt;"],
  ["&lt;&lt;👔 Sócio(a) 2&gt;&gt;", "&lt;&lt;socio_2_nome&gt;&gt;"],
  ["&lt;&lt;👨‍💼 Autorização 2&gt;&gt;", "&lt;&lt;socio_2_papel&gt;&gt;"],
  ["&lt;&lt;⚖️ Porcentagem 2&gt;&gt;", "&lt;&lt;socio_2_pct&gt;&gt;"],
  ["&lt;&lt;👔 Sócio(a) 3&gt;&gt;", "&lt;&lt;socio_3_nome&gt;&gt;"],
  ["&lt;&lt;👨‍💼 Autorização 3&gt;&gt;", "&lt;&lt;socio_3_papel&gt;&gt;"],
  ["&lt;&lt;⚖️ Porcentagem 3&gt;&gt;", "&lt;&lt;socio_3_pct&gt;&gt;"],
  ["&lt;&lt;👔 Sócio(a) 4&gt;&gt;", "&lt;&lt;socio_4_nome&gt;&gt;"],
  ["&lt;&lt;👨‍💼 Autorização 4&gt;&gt;", "&lt;&lt;socio_4_papel&gt;&gt;"],
  ["&lt;&lt;⚖️ Porcentagem 4&gt;&gt;", "&lt;&lt;socio_4_pct&gt;&gt;"],
  ["&lt;&lt;👔 Sócio(a) 5&gt;&gt;", "&lt;&lt;socio_5_nome&gt;&gt;"],
  ["&lt;&lt;👨‍💼 Autorização 5&gt;&gt;", "&lt;&lt;socio_5_papel&gt;&gt;"],
  ["&lt;&lt;⚖️ Porcentagem 5&gt;&gt;", "&lt;&lt;socio_5_pct&gt;&gt;"],
];

function processXml(xml: string): string {
  let out = xml;
  for (const [oldVal, newVal] of REPLACEMENTS) {
    out = out.split(oldVal).join(newVal);
  }
  return out;
}

function main() {
  const bytes = readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(bytes);

  const filesToProcess = ["word/document.xml", "word/header1.xml", "word/footer1.xml"];
  for (const name of filesToProcess) {
    const file = zip.file(name);
    if (file) {
      const xml = file.asText();
      const updated = processXml(xml);
      zip.file(name, updated);
    }
  }

  const out = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  writeFileSync(TEMPLATE_PATH, out);
  console.log("Template atualizado:", TEMPLATE_PATH);
}

main();
