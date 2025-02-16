import fs from "fs";
import path from "path";
import readline from "readline";
import Fuse from "fuse.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECTORY = path.join(__dirname, "../data/students/");

// Read and index all JSON files
const students = [];
fs.readdirSync(DIRECTORY).forEach(file => {
  if (file.endsWith(".json")) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DIRECTORY, file), "utf-8"));
      if (Array.isArray(data)) students.push(...data);
      else students.push(data);
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }
});

if (students.length === 0) {
  console.error("No student data found!");
  process.exit(1);
}

// Fuse.js search setup
const fuse = new Fuse(students, {
  keys: ["UserName", "AshokaId", "AshokaEmailId"],
  threshold: 0.3,
  includeScore: false
});

// CLI Setup
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("Type a name to search (Ctrl+C to exit):");

rl.on("line", (query) => {
  if (!query.trim()) return;

  const results = fuse.search(query).slice(0, 20);
  console.clear();
  console.log("Results:");
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.item.UserName} (${result.item.AshokaId})`);
  });
});
