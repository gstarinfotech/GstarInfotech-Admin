import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";
dotenv.config();
const {Pool}=pg;
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes("localhost")?false:{rejectUnauthorized:false}});
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../migrations");
try {
  const files=fs.readdirSync(dir).filter(x=>x.endsWith(".sql")).sort();
  for(const file of files){console.log(`Applying ${file}`);await pool.query(fs.readFileSync(path.join(dir,file),"utf8"));}
  console.log("Database migrations completed.");
} finally {await pool.end();}
