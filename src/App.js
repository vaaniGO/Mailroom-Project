import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from 'cors';
global.fetch = fetch;
import path from 'path'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';
import mysql from 'mysql2';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import parser from 'json2csv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIRECTORY = path.join(__dirname, "../data/students/");
const students = [];

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(cors()); // Allow all origins (or configure properly)


app.use(express.static(path.join(__dirname, 'public')));


app.set('view engine', 'ejs');

// Set the views directory (optional, defaults to 'views/')
app.set('views', path.join(__dirname, 'views'));

// For handling form submission - this is a middleware
app.use(express.urlencoded({ extended: true }));

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
  res.redirect('/package-out');
});

app.get("/package-out", async (req, res) => {
  res.render('package-out-scan-qr');
});

app.get("/package-in/user", async (req, res) => {
  res.render('package-in-user');
});

app.get("/package-in/tracking-id", async (req, res) => {
  res.render('package-in-tracking-id');
});

let authToken = null;
let refreshToken = null;
const BASE_URL = process.env.BASE_URL;
 
 // Function to log in and obtain a new token
 async function login() {
     try {
         const response = await fetch(`${BASE_URL}api/TPIntegration/Login`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
                 "UserId": process.env.USER_ID,
                 "Password": process.env.PASSWORD
             })
         });
 
         const data = await response.json();
         if (data.ErrorCode === 0) {
             authToken = data.Token;
             refreshToken = data.RefreshToken;
             console.log("Login Successful. Token:", authToken);
             return authToken;
         } else {
             throw new Error(`Login Failed: ${data.ErrorMessage}`);
         }
     } catch (error) {
         console.error("Login Error:", error.message);
         return null;
     }
 }

 // Function to refresh the authentication token
 async function refreshAuthToken() {
  try {
      if (!refreshToken) {
          console.error("No Refresh Token available. Re-authenticating...");
          return await login();
      }

      const response = await fetch(`${BASE_URL}api/User/RefreshToken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              "Token": authToken,
              "RefreshToken": refreshToken
          })
      });

      const data = await response.json();
      if (data.ErrorCode === 0) {
          authToken = data.Token;
          refreshToken = data.RefreshToken;
          console.log("Token Refreshed Successfully.");
          return authToken;
      } else {
          console.warn("Refresh Token Expired. Re-authenticating...");
          return await login();
      }
  } catch (error) {
      console.error("Refresh Token Error:", error.message);
      return null;
  }
}

// Function to validate QR Code using API
async function processQr(qrString) {
  try {
      // Ensure we have a valid token
      if (!authToken) {
          console.log("No Auth Token found. Attempting login...");
          await login();
      }

      // Call ValidateQRCode API
      const response = await fetch(`${BASE_URL}api/TPIntegration/ValidateQRCodeTP`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ "QRCodeValue": qrString })
      });

      const data = await response.json();

      // If token is expired, refresh it and retry
      if (data.ErrorCode !== 0 && data.ErrorMessage.includes("token")) {
          console.warn("Token Expired. Refreshing...");
          await refreshAuthToken();
          return await processQr(qrString);
      }

      // If QR validation fails
      if (data.ErrorCode !== 0) {
          return { isValid: false, error: data.ErrorMessage };
      }

      console.log("QR Code Validated Successfully.");
      console.log("Ashoka ID:", data.UserSysGenId);
      return {
          isValid: true,
          ashokaId: data.UserSysGenId
      };
  } catch (error) {
      console.error("QR Code Validation Error:", error.message);
      return { isValid: false, error: error.message };
  }
}

// Create a connection to the MySQL database using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'packages',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
});

// Route to display packages
app.get('/package-out/user/:qrString', (req, res) => {
  // assume we call the AMS API here to get ashokaId from 
  // const ashokaId = request("ams.ashoka.edu.in", qrString)
  // const qrValid = request("ams.ashoka.edu.in", qrString)
  if (processQr(req.params.qrString).isValid) {
    const ashokaId = processQr(req.params.qrString).ashokaId;
    const studentData = students.find(student => student.AshokaId == ashokaId);
    // Right now, the pending filter is commented for testing purposes. Simply remove -- to make it active.
    db.query(
      "SELECT packageNo, timestamp, ashokaId, deliveryPartner, status, remarks, collectedBy, collectedAt FROM Packages WHERE ashokaId = ? -- AND status = 'pending'",
      [ashokaId],
      (err, results) => {
        if (err) {
          return res.status(500).send("Error fetching packages");
        }
        // console.log(results);
        if (results.length > 0) {
          var personCollecting = processQr(req.params.qrString).ashokaId;
          res.render('view-packages.ejs', { student: studentData, packages: results, friend:false, personCollecting:personCollecting});
        } else {
          res.render("error", { msg: "No Packages" });
        }
      }
    );
  } else {
    res.render("error", { msg: "Invalid QR Code" });
  }
});

// url naked/signature/history proof basically

// Route to display packages of others on your QR code
app.get('/package-out/friend/:id/:qrString', (req, res) => {
  // assume we call the AMS API here to get ashokaId from 
  // const ashokaId = request("ams.ashoka.edu.in", qrString)
  // const qrValid = request("ams.ashoka.edu.in", qrString)
  var personCollecting = processQr(req.params.qrString).ashokaId;
  if (processQr(req.params.qrString).isValid) {
    const ashokaId = req.params.id;
    const studentData = students.find(student => student.AshokaId == ashokaId);
    // Right now, the pending filter is commented for testing purposes. Simply remove -- to make it active.
    db.query(
      "SELECT packageNo, timestamp, ashokaId, deliveryPartner, status, remarks, collectedBy, collectedAt  FROM Packages WHERE ashokaId = ? -- AND status = 'pending'",
      [ashokaId],
      (err, results) => {
        if (err) {
          return res.status(500).send("Error fetching packages");
        }
        // console.log(results);
        if (results.length > 0) {
          res.render('view-packages.ejs', { student: studentData, packages: results, friend:true, personCollecting:personCollecting});
        } else {
          res.render("error", { msg: "No Packages" });
        }
      }
    );
  } else {
    res.render("error", { msg: "Invalid QR Code" });
  }
});

app.get('/package-out/friend/:qrString', (req, res) => {
  // assume we call the AMS API here to get ashokaId from 
  // const ashokaId = request("ams.ashoka.edu.in", qrString)
  if (processQr(req.params.qrString).isValid) {
    res.render('package-out-friend', { qrString: req.params.qrString });
  } else {
    res.render("error", { msg: "Invalid QR Code" });
  }
});

// Checkout for packages with student details, NOT for tracking ID packages
app.post('/checkout', (req, res) => {
  const selectedPackages = req.body.packages; // Array of objects {packageNo, AshokaId, timestamp}
  const personCollecting = req.body.personCollecting; // Person collecting the package
  
  // Get current timestamp in IST (Indian Standard Time)
  const collectedAt = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Format as 'YYYY-MM-DD HH:mm:ss'

  // console.log("SELECTED", selectedPackages);

  if (Array.isArray(selectedPackages) && selectedPackages.length > 0) {
    // Prepare the placeholders and values for SQL
    const conditions = selectedPackages.map(pkg =>
      `(packageNo = ? AND ashokaID = ? AND timestamp = ?)`
    ).join(' OR ');

    const query = `
      UPDATE Packages 
      SET status = 'received', collectedBy = ?, collectedAt = ?
      WHERE (${conditions}) 
      AND status = 'pending';
    `;

    // Flatten the values array
    const values = [personCollecting, collectedAt, ...selectedPackages.flatMap(pkg => [pkg.packageNo, pkg.AshokaId, pkg.timestamp])];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Error during checkout:", err);
        return res.status(500).send("Error during checkout");
      }

      // Render the success-checkout page with the first package's Ashoka ID
      const packageDetails = { ID: selectedPackages[0].AshokaId }; // Use the first package's Ashoka ID
      // console.log(selectedPackages);
      res.render('success-checkout', { packageDetails });
    });
  } else {
    res.status(400).json({ message: "No packages selected." });
  }
});


// Checkout for tracking ID packages - error handling included
app.post('/checkout-trackingID', (req, res) => {
  const { packages, personCollecting } = req.body; // Destructure `packages` array and `personCollecting`

  if (!packages || packages.length === 0) {
    return res.status(400).send("No packages provided");
  }

  const packageDetails = packages[0]; // Access the first package in the array
  const trackingID = String(packageDetails.trackingID); // Get the trackingID

  if (!trackingID) {
    return res.status(400).send("TrackingID is missing");
  }

  // Get current timestamp in IST (Indian Standard Time)
  const collectedAt = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Format as 'YYYY-MM-DD HH:mm:ss'

  // SQL query to update the status, collectedBy, and collectedAt where the trackingID matches
  const query = `UPDATE Packages SET status = 'received', collectedBy = ?, collectedAt = ? WHERE trackingID = ?;`;

  db.query(query, [personCollecting, collectedAt, trackingID], (err, result) => {
    if (err) {
      console.error("Error during checkout:", err);
      return res.status(500).send("Error during checkout");
    } else {
      // Check if any rows were affected
      if (result.affectedRows > 0) {
        // Render the success page with tracking ID
        res.render('success-checkout', { packageDetails: { ID: trackingID } });
      } else {
        res.status(404).json({ message: "No matching package found" });
      }
    }
  });
});

// POST endpoint to insert a package
app.post('/insertpackage', (req, res) => {
  var { ashokaID, trackingID, deliveryPartner, remarks, shelf, trackingIDByUser } = req.body;
  const status = 'pending';
  let studentData, studentName, shelfNo;

  // Extract first letter of ashokaID for shelfNo
  if (trackingID == null) {
    studentData = students.find(student => student.AshokaId == ashokaID);
    studentName = studentData.UserName;
    shelfNo = studentName ? studentName.charAt(0).toUpperCase() : "X"; // Default shelf
  } else {
    studentName = '';
    shelfNo = shelf;
  }
  // set trackingID = trackingIDByUser so we can enter tracking ID as well for
  // packages that are of identified users
  trackingID = trackingID == null? trackingIDByUser : trackingID;
  // Get today's date in YYYY-MM-DD format
  const today = moment().format('YYYY-MM-DD');

  // Query to get the count of today's packages
  const countQuery = `
    SELECT COUNT(*) AS count FROM Packages
    WHERE DATE(timestamp) = ?;
  `;

  db.query(countQuery, [today], (err, result) => {
    if (err) {
      console.error('Error fetching package count:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    let packageNo = 1; // Default package number

    if (result.length > 0) {
      const count = result[0].count; // Get the count of today's packages
      packageNo = count + 1; // The next package number will be count + 1
    }

    // Get current timestamp in IST (Indian Standard Time)
    const now = moment().tz('Asia/Kolkata'); // Adjust to IST time zone

    // Format the timestamp as "YYYY-MM-DD HH:mm:ss"
    const formattedTimestamp = now.format('YYYY-MM-DD HH:mm:ss');

    // Insert package into the database
    const insertQuery = `
      INSERT INTO Packages (ashokaID, trackingID, packageNo, shelfNo, timestamp, deliveryPartner, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [ashokaID, trackingID, packageNo, shelfNo, formattedTimestamp, deliveryPartner, status, remarks], (err, result) => {
      if (err) {
        console.error('Error inserting package:', err);
        return res.status(500).json({ message: 'Failed to insert package' });
      } else {
        // Prepare the packageDetails object to pass to the view
        const packageDetails = {
          packageNo: packageNo,
          timestamp: formattedTimestamp,
          shelfNo: shelfNo,
          remarks: remarks
        };

        // console.log("TIME", packageDetails);

        // Render the success-log view with the packageDetails object
        res.render('success-log', { packageDetails: packageDetails });
      }
    });
  });
});

app.get('/success-checkout', (req, res) => {
  // Get the query parameters
  const studentName = req.query.studentName || '';

  // Render the EJS page with the required variables
  res.render('success-checkout', {
    studentName
  });
});

app.get('/success-log', (req, res) => {
  const packageDetails = {
    packageNo: req.query.packageNo,
    shelfNo: req.query.shelfNo,
    timestamp: req.query.timestamp,
    remarks: req.query.remarks
  };
  // console.log(packageDetails);
  res.render('success-log', { packageDetails });
});

// API endpoint to search for a tracking ID
app.get('/track', (req, res) => {
  const trackingID = req.query.trackingID;
  if (!trackingID) {
    return res.status(400).json({ error: 'Tracking ID is required' });
  }

  const query = 'SELECT * FROM packages WHERE trackingID = ?';
  db.query(query, [trackingID], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No package found with this tracking ID' });
    }

    res.json(results[0]); // Return the first matching result
  });
});

app.get('/package-out/tracking-id/:qrString', (req, res) => {
  var personCollecting = processQr(req.params.qrString).ashokaId;
  if (processQr(req.params.qrString).isValid) {
    res.render('search-by-tracking-id',{personCollecting:personCollecting});
  } else {
    res.render("error", { msg: "Invalid QR Code" });
  }
});

app.get('/backup', (req, res) => {
  const selectedDate = req.query.selectedDate || new Date().toISOString().split('T')[0]; // Default to today's date
  res.render('backup', { selectedDate, packages: [] });
});

app.post('/backup', (req, res) => {
  let selectedDate = req.body.selectedDate;
  console.log(req.body);

  // Ensure selectedDate is defined, if not, use the current date as default
  if (!selectedDate) {
    selectedDate = new Date().toISOString().split('T')[0]; // Default to today's date
  }

  // Query MySQL to get all packages that match the selected date (ignoring time)
  db.query(
    'SELECT * FROM packages WHERE DATE(timestamp) = ?',
    [selectedDate],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database query error');
      }

      // Render the page with the data from MySQL
      res.render('backup', {
        selectedDate,
        packages: results
      });
    }
  );
});



app.get('*', (req, res) => {
  res.render("error", { msg: "404 Not Found" });
});

app.listen(port || 3000, function () {
  console.log("listening on port ", port || 3000)
});