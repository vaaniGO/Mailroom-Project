import express from 'express';
import { MeiliSearch } from 'meilisearch';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from 'cors';
global.fetch = fetch;
import path from 'path'
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

app.use(cors()); // Allow all origins (or configure properly)
const meiliClient = new MeiliSearch({
  host: "http://127.0.0.1:7700"
});


app.use(express.static(path.join(__dirname, 'public')));

// Health check route
app.get("/health", async (req, res) => {
  try {
    const health = await meiliClient.health();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.set('view engine', 'ejs');

// Set the views directory (optional, defaults to 'views/')
app.set('views', path.join(__dirname, 'views'));
async function uploadData() {
  try {
    // Read JSON file
    let data = JSON.parse(fs.readFileSync("../sg-scripts/misc/student_directory/ug23-27.json", "utf-8"));

    // Filter out documents with invalid or missing AshokaId
    data = data.filter(doc => doc.AshokaId && /^[a-zA-Z0-9_-]+$/.test(doc.AshokaId));

    if (data.length === 0) {
        console.error("No valid documents to upload.");
        return;
    }

    console.log("Uploading", data.length, "valid records...");

    const index = meiliClient.index("ug21-24");

    await index.addDocuments(data, { primaryKey: "AshokaId" });

    console.log("Upload Successful");
  } catch (error) {
    console.error("Error uploading data:", error);
  }
}

  // Run the upload function
// uploadData();

async function configureIndex() {
  const index = meiliClient.index("ug21-24");
  await index.updateFilterableAttributes(["AshokaId"]);
  await index.updateSearchableAttributes(["UserName", "AshokaEmailId", "AshokaId"]);
  await index.updateRankingRules([
      "typo",
      "words",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "AshokaId:desc",
      "AshokaEmailId:desc",
      "UserName:desc"
  ]);

  console.log("Index configured successfully!");
}

async function searchData(query) {
  const index = meiliClient.index("ug21-24");

  const searchResults = await index.search(query, {
      filter: [
          "AshokaId IS NOT NULL", // Ensures filtering is effective
      ],
  });

  console.log(searchResults);
}

// Run configuration once before searching
// configureIndex().then(() => {
// searchData("Maan");
// });

app.get("/search", async (req, res) => {
  const query = req.query.q; // Get user input from query params
  console.log(req.query);

  try {
    const index = meiliClient.index("ug21-24");
    const searchResults = await index.search(query, {
      limit: 10, // Limit the number of results
    });
    console.log(searchResults.hits);

    res.json(searchResults.hits); // Return results to the frontend
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", async (req, res) => {
  res.render("home");
  // res.sendFile('home.html', { root: path.join(__dirname, 'views') });
});

app.get("/guard", async (req, res) => {
  res.render('package-log');
});

app.get("/user", async (req, res) => {
  res.render('student-login');
});

// app.get("/login", async (req, res) => {
//   res.sendFile('student-login.html', { root: path.join(__dirname, 'views') });
// });

app.listen(port || 3000, function(){
  console.log("listening on port ",port || 3000)
});
