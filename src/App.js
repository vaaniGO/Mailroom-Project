import express from 'express';
import { MeiliSearch } from 'meilisearch';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from 'cors';
global.fetch = fetch;
import path from 'path'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIRECTORY = path.join(__dirname, "../data/students/");
const students = [];

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

// Function to upload data to MeiliSearch
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

// Function to configure Index in MeiliSearch
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

// Levenschtein distance function : Previous
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

// Populating the students array with data from JSON files
fs.readdirSync(DIRECTORY).forEach(file => {
  if (file.endsWith('.json')) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DIRECTORY, file), 'utf-8'));
      if (Array.isArray(data)) students.push(...data);
      else students.push(data);
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }
});

// Initialising fuse
const fuse = new Fuse(students, {
  keys: ['UserName', 'AshokaId', 'AshokaEmailId'],
  threshold: 0.3,
  distance: 50,
  // ignoreLocation: true,
  includeScore: true
});

// Performing fuse search using students array with the previously mentioned keys 
app.get('/search2', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required'
      });
    }

    const searchResults = fuse.search(query)
      .slice(0, 20) // Limit to top 20 results
      .map(result => ({
        UserName: result.item.UserName,
        AshokaId: result.item.AshokaId,
        AshokaEmailId: result.item.AshokaEmailId,
        score: result.score
      }));
    
      // console.log('Query:', query);
      // console.log('Search Results:', searchResults);

    res.status(200).json({
      success: true,
      data: searchResults
    });

  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: err.message
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

// Create a connection to the MySQL database using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST,         // From .env file
  user: process.env.DB_USER,         // From .env file
  password: process.env.DB_PASSWORD, // From .env file
  database: process.env.DB_NAME      // From .env file
});

// Route to display packages
app.get('/packages/:ashokaId', (req, res) => {
  const ashokaId = req.params.ashokaId;
  console.log(students[0]);
  const studentData = students.find(student => student.AshokaID = ashokaId);
  console.log(ashokaId);
  db.query("SELECT packageNo, timestamp, deliveryPartner FROM Packages WHERE ashokaId = ?", [ashokaId], (err, results) => {
    if (err) {
      return res.status(500).send("Error fetching packages");
    }
    console.log(studentData);
    res.render('view-packages.ejs', { student: studentData, packages: results });
  });
});

// Route to handle checkout : INCOMPLETE
app.post('/checkout', (req, res) => {
  const selectedPackages = req.body.packages; // Array of objects {packageNumber, AshokaId, timestamp}
  
  if (Array.isArray(selectedPackages) && selectedPackages.length > 0) {
    // Prepare the placeholders and values for SQL
    const placeholders = selectedPackages.map(() => '(?, ?, ?)').join(',');
    const values = selectedPackages.flatMap(pkg => [pkg.packageNumber, pkg.AshokaId, pkg.timestamp]);

    // SQL query to delete where packageNumber, AshokaId, and timestamp match
    db.run(`DELETE FROM Packages WHERE (packageNumber, AshokaId, timestamp) IN (${placeholders})`, values, (err) => {
      if (err) {
        return res.status(500).send("Error during checkout");
      }
      res.send("Success");
    });
  } else {
    res.send("No packages selected");
  }
});

// POST endpoint to insert a package
app.post('/insertpackage', (req, res) => {
  const { ashokaID, trackingID, packageNo, shelfNo, timestamp, deliveryPartner, status } = req.body;
    console.log(ashokaID);
    console.log(trackingID);
    // Insert package into the database
    const query = `
    INSERT INTO Packages (ashokaID, trackingID, packageNo, shelfNo, timestamp, deliveryPartner, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;


  db.query(query, [ashokaID, trackingID, packageNo, shelfNo, timestamp, deliveryPartner, status], (err, result) => {
    if (err) {
      console.error('Error inserting package:', err);
      res.status(500).json({ message: 'Failed to insert package' });
    } else {
      res.status(200).json({ message: 'Package inserted successfully' });
    }
  });
});


app.listen(port || 3000, function(){
  console.log("listening on port ",port || 3000)
});
