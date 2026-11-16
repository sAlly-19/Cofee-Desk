// Collect PNGs only: never export test profiles, databases or operator secrets.
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "artifacts/capturas-coffee-desk-2026-11-16");
const groups = [
  ["cliente", "artifacts/redesign"],
  ["modais", "artifacts/screenshots-current/modals"],
  ["administracao", "artifacts/admin-browser"],
  ["sessao-refatorada", "artifacts/session-refactor"],
];
const items = [];
fs.mkdirSync(out, { recursive: true });
for (const [group, source] of groups) {
  const target = path.join(out, group);
  fs.mkdirSync(target, { recursive: true });
  for (const name of fs
    .readdirSync(path.join(root, source))
    .filter((n) => n.endsWith(".png"))
    .sort()) {
    const bytes = fs.readFileSync(path.join(root, source, name));
    if (bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a")
      throw Error("Invalid PNG");
    fs.writeFileSync(path.join(target, name), bytes);
    items.push({
      group,
      name,
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      file: group + "/" + name,
    });
  }
}
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify(
    {
      capturedOn: "2026-11-16",
      count: items.length,
      notes:
        "Cliente e administração em ambientes locais isolados. Modais usam componentes reais e dados demonstrativos. Atualizações não baixadas nem instaladas.",
      images: items,
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(out, "README.md"),
  "# Capturas Coffee Desk — 16/11/2026\n\n" +
    items.length +
    " imagens PNG. Abra index.html para navegar.\n\n- cliente/: interface real em duas instâncias locais, chamadas, sessão, clipboard, arquivos, configurações, histórico, favoritos e confirmações. Página inicial em 1672×941, 1440×900 e 1024×680.\n- modais/: os oito componentes principais e estados complementares montados com dados demonstrativos; atualização somente simulada.\n- administracao/: login, dispositivos, detalhes, denúncias, decisões, bloqueio, desbloqueio, banimento e auditoria, com PostgreSQL local de teste.\n\nAs imagens de sessão usam captura real da área de trabalho local e podem apresentar efeito de espelho. Os IDs pertencem ao ambiente de teste. Nenhum dado de produção, instalador, download de atualização, publicação ou deploy foi usado. Diálogos nativos do Windows (seletor de arquivos, UAC e menu do sistema) não fazem parte desta galeria dos componentes do aplicativo.\n\nReprodução após build: npm run verify:redesign; npm run test:admin; executar scripts/capture-modal-catalog.js com Electron e ELECTRON_RUN_AS_NODE removido; node scripts/export-screenshot-catalog.js.\n",
);
fs.writeFileSync(
  path.join(out, "index.html"),
  '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Capturas — Coffee Desk</title><style>body{margin:0;background:#160e0b;color:#f5ead8;font:16px system-ui}header{padding:32px;position:sticky;top:0;background:#21150ff5;z-index:1;border-bottom:1px solid #70482b}h1{margin:0 0 8px}p{color:#c5ac94}input{padding:12px;background:#160e0b;color:#fff;border:1px solid #70482b;border-radius:8px;width:min(80%,420px)}main{padding:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px}article{background:#24170f;border:1px solid #70482b;border-radius:12px;overflow:hidden}img{width:100%;height:230px;object-fit:contain;background:#0c0806}a{color:#ffbb79;text-decoration:none}h2{font-size:15px;padding:0 16px;overflow-wrap:anywhere}small{display:block;padding:0 16px 18px;color:#c5ac94}</style><header><h1>Coffee Desk — capturas atuais</h1><p>16/11/2026 · ' +
    items.length +
    ' imagens · Clique para abrir em tamanho original. Dados de teste local.</p><input id="search" aria-label="Filtrar capturas" placeholder="Filtrar por nome ou grupo"></header><main>' +
    items
      .map(
        (i) =>
          '<article data-search="' +
          escape(i.group + " " + i.name) +
          '"><a href="' +
          i.file +
          '" target="_blank"><img loading="lazy" src="' +
          i.file +
          '" alt="' +
          escape(i.name) +
          '"><h2>' +
          escape(i.name) +
          "</h2></a><small>" +
          i.group +
          " · " +
          i.width +
          " × " +
          i.height +
          "</small></article>",
      )
      .join("") +
    '</main><script>document.querySelector("#search").oninput=e=>{const q=e.target.value.toLocaleLowerCase();document.querySelectorAll("article").forEach(a=>a.hidden=!a.dataset.search.toLocaleLowerCase().includes(q));}</script></html>',
);
console.log(items.length + " PNGs exported to " + out);
