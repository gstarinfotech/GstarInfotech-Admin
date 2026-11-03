import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";
dotenv.config();
const {Pool}=pg;
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const seedDir=path.resolve(__dirname,"../data-seed");
const legacyDir=process.env.LEGACY_DATA_DIR?path.resolve(process.cwd(),process.env.LEGACY_DATA_DIR):seedDir;
const caseFile=process.env.LEGACY_CASE_STUDIES_FILE?path.resolve(process.cwd(),process.env.LEGACY_CASE_STUDIES_FILE):path.join(legacyDir,"case-studies.json");
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes("localhost")?false:{rejectUnauthorized:false}});
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{return fallback;}}
function pick(name,fallback){const fromLegacy=path.join(legacyDir,name);return readJson(fs.existsSync(fromLegacy)?fromLegacy:path.join(seedDir,name),fallback);}
async function main(){
 let stats={blogs:0,leads:0,seo:0,inventory:0,projects:0};
 await pool.query("BEGIN");
 try{
  const blogs=pick("blogPosts.json",[]);
  for(const item of blogs){if(!item?.slug)continue;const r=await pool.query("INSERT INTO blogs(slug,data) VALUES($1,$2::jsonb) ON CONFLICT(slug) DO NOTHING",[String(item.slug),JSON.stringify(item)]);stats.blogs+=r.rowCount;}
  const leads=pick("contact-submissions.json",[]);
  for(const item of leads){const id=String(item.id||item._id||`legacy-${stats.leads}-${Date.now()}`);const data={...item,id};const r=await pool.query("INSERT INTO leads(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",[id,JSON.stringify(data)]);stats.leads+=r.rowCount;}
  const seo=pick("seo-settings.json",{});
  for(const [p,item] of Object.entries(seo)){const r=await pool.query("INSERT INTO seo_pages(path,data) VALUES($1,$2::jsonb) ON CONFLICT(path) DO NOTHING",[p,JSON.stringify(item)]);stats.seo+=r.rowCount;}
  const inventory=pick("page-inventory.json",[]);
  for(const item of inventory){if(!item.path)continue;const r=await pool.query("INSERT INTO page_inventory(path,data) VALUES($1,$2::jsonb) ON CONFLICT(path) DO NOTHING",[item.path,JSON.stringify(item)]);stats.inventory+=r.rowCount;}
  const settings=pick("site-settings.json",{headCode:"",bodyStartCode:"",bodyEndCode:""});
  await pool.query("INSERT INTO site_settings(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING",[JSON.stringify(settings)]);
  const projects=pick("projects.json",[]);
  const cases=readJson(caseFile,pick("case-studies.json",[]));
  const caseMap=new Map((Array.isArray(cases)?cases:[]).map(x=>[String(x.id),x]));
  for(const category of projects){
    const categoryId=String(category.id||"uncategorized");
    for(const item of (category.projects||[])){
      const id=String(item.id||"");if(!id)continue;
      const caseStudy=caseMap.get(id)||item.caseStudy||null;
      const r=await pool.query("INSERT INTO projects(id,category_id,data,case_study) VALUES($1,$2,$3::jsonb,$4::jsonb) ON CONFLICT(id) DO NOTHING",[id,categoryId,JSON.stringify(item),caseStudy?JSON.stringify(caseStudy):null]);
      stats.projects+=r.rowCount;
    }
  }
  await pool.query("COMMIT");
 }catch(e){await pool.query("ROLLBACK");throw e;}
 console.log("Legacy import complete (existing database records were not overwritten):",stats);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
