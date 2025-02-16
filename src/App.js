import express from 'express';
import { MeiliSearch } from 'meilisearch';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from 'cors';
global.fetch = fetch;
import path from 'path'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './connectSQL.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

app.use(cors()); // Allow all origins (or configure properly)
const meiliClient = new MeiliSearch({
  host: "http://127.0.0.1:7700",
  apiKey: "7b5c0e77b50c92c388e25ef2ce4fd0d2bbb80053",
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
    let data = JSON.parse(fs.readFileSync("data/students/ug22-26.json", "utf-8"));

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
//uploadData();

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

app.get('/search', async (req, res) => {
  try {
    // Extract query parameters
    const studentName = req.query.q;
    const ashokaID = req.query.q;
    const emailID = req.query.q;

    // Setting Variables
    const variables = `
      SET @student_name = '${studentName}';
      SET @ashoka_id = '${ashokaID}';
      SET @email_id = '${emailID}';
      SET @NameSimilarityScoreThreshold = 30;
      SET @IDSimilarityScoreThreshold = 30;
      SET @EmailSimilarityScoreThreshold = 30;
      SET @NameSimilarityScoreThresholdIndividual = 30;
      SET @IDSimilarityScoreThresholdIndividual = 30;
      SET @EmailSimilarityScoreThresholdIndividual = 30;
    `;

    // Main Search Query
    const searchQuery = `
      SELECT student_name, email_id, ashoka_id,
        (100 - (100 * Levenshtein(student_name, @student_name) / CHAR_LENGTH(@student_name))) AS NameSimilarityScore,
        (100 - (100 * Levenshtein(ashoka_id, @ashoka_id) / CHAR_LENGTH(@ashoka_id))) AS AshokaIDSimilarityScore,
        (100 - (100 * Levenshtein(email_id, @email_id) / CHAR_LENGTH(@email_id))) AS EmailIDSimilarityScore
      FROM students
      WHERE (
          (100 - (100 * Levenshtein(student_name, @student_name) / CHAR_LENGTH(@student_name))) >= @NameSimilarityScoreThreshold
          AND (100 - (100 * Levenshtein(ashoka_id, @ashoka_id) / CHAR_LENGTH(@ashoka_id))) >= @IDSimilarityScoreThreshold
          AND (100 - (100 * Levenshtein(email_id, @email_id) / CHAR_LENGTH(@email_id))) >= @EmailSimilarityScoreThreshold
      )
      OR (100 - (100 * Levenshtein(student_name, @student_name) / CHAR_LENGTH(@student_name))) >= @NameSimilarityScoreThresholdIndividual
      OR (100 - (100 * Levenshtein(ashoka_id, @ashoka_id) / CHAR_LENGTH(@ashoka_id))) >= @IDSimilarityScoreThresholdIndividual
      OR (100 - (100 * Levenshtein(email_id, @email_id) / CHAR_LENGTH(@email_id))) >= @EmailSimilarityScoreThresholdIndividual
      ORDER BY NameSimilarityScore DESC, AshokaIDSimilarityScore DESC, EmailIDSimilarityScore DESC;
    `;

    console.log(variables)
    // Set variables
    await db.promise().query(variables);

    // Execute search query
    const [results] = await db.promise().query(searchQuery);
    console.log(results);
    console.log('Query Parameters:', studentName, ashokaID, emailID);
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: err.message, 
      stack: err.stack
    });
  }
});


app.get("/", async (req, res) => {
  res.render('student-login');
  // res.render("home");
  // res.sendFile('home.html', { root: path.join(__dirname, 'views') });
});

app.get("/guard", async (req, res) => {
  res.render('package-log');

});

app.get("/success", async (req, res) => {
  res.render('success');
});

// app.get("/login", async (req, res) => {
//   res.sendFile('student-login.html', { root: path.join(__dirname, 'views') });
// });

app.listen(port || 3000, function(){
  console.log("listening on port ",port || 3000)
});
