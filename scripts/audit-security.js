const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');const out=path.join(root,'artifacts/security-audit');fs.mkdirSync(out,{recursive:true});
const cli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
let failed=false;
for(const [name,args]of [['client',['audit','--json']],['server',['audit','--json','--prefix','signaling-server']],['server-runtime',['audit','--json','--omit=dev','--prefix','signaling-server']]]){
 const result=spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',windowsHide:true});
 try{const report=JSON.parse(result.stdout);if(report.error||!report.metadata)throw new Error();fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(report,null,2));const count=report.metadata.vulnerabilities.total;console.log(name+': '+count+' vulnerabilidades reportadas');if(count)failed=true;}catch{console.error(name+': auditoria indisponível');failed=true;}
}
process.exitCode=failed?1:0;
