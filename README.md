# Mailroom-Project
Changes and improvements: 
1. Validating for 'Next' button after selecting<br>
   a. Student<br>
   b. Tracking ID<br>
   c. Delivery partner<br>
2. Storing the JSON response locally to populate all fields with the same information
3. Adjust MeiliSearch parameters after looking at all edge-cases
4. Align all boxes to the same position on the page

<h3>To set up on your laptop</h3><br>
1. Install meilisearch and configure it with the key in the terminal using the command : ./meilisearch --env development --master-key your_master_key <br>
2. Run App.js
3. To upload a JSON file, change the file name in the code (there is only one place). Do not change the index name.<br>
4. Save and run for each file to upload to the same index. <br>
5. When we upload, the task gets enqued and might take a few seconds to reflect.<br>
6. Run the frontend as needed. <br>
