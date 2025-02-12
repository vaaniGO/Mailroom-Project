import express from 'express';
import { MeiliSearch } from 'meilisearch';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from 'cors';
global.fetch = fetch;

const app = express();
const port = 3000;

app.use(express.json());

app.use(cors()); // Allow all origins (or configure properly)

// Initialize Meilisearch client
const meiliClient = new MeiliSearch({
  host: "http://127.0.0.1:7700", // Default Meilisearch URL
  apiKey: "7b5c0e77b50c92c388e25ef2ce4fd0d2bbb80053", // Replace with your actual API key
});

// Health check route
app.get("/health", async (req, res) => {
  try {
    const health = await meiliClient.health();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Function to upload JSON data
async function uploadData() {
    try {
      // Read JSON file
      const data = JSON.parse(fs.readFileSync("ug22-26.json", "utf-8"));
       console.log(data)
      // Select index (will be created if it doesn't exist)
      const index = meiliClient.index("ug21-24");
  
      // Add documents to Meilisearch
      const response = await index.addDocuments(data);
      console.log("Upload Successful:", response);
    } catch (error) {
      console.error("Error uploading data:", error);
    }
  }
  // Run the upload function
// uploadData();

async function configureIndex() {
  const index = meiliClient.index("ug21-24");

  // ✅ Set `AshokaId` as a filterable attribute
  await index.updateFilterableAttributes(["AshokaId"]);

  // ✅ Set custom searchable attributes
  await index.updateSearchableAttributes(["UserName", "AshokaEmailId", "AshokaId"]);

  // ✅ Set ranking rules and custom weights
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

app.listen(port, () => {
  console.log(`Server is running on http://127.0.0.1:${port}`);
});