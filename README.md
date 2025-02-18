# Mailroom-Project
<h2> View #1: Guard side | while logging the package </h2>
As shown below, the guard can type in a few letters of the name displayed on the package (or the student's ashokaID) and then select the student from the dropdown. <br>
For students having same names, guards can verify the ashoka ID displayed on the right side in the dropdown. <br> <br>
<img width="1708" alt="Screenshot 2025-02-19 at 12 22 14 AM" src="https://github.com/user-attachments/assets/e7c4b537-248a-4e8c-b56d-344e6f67e497" /> <br> <br>
After selecting the student, they select the delivery service as shown below. <br> <br>
<img width="1709" alt="Screenshot 2025-02-19 at 12 27 50 AM" src="https://github.com/user-attachments/assets/aa5a020d-15a8-4ea4-9898-6526819554ed" /><br> <br>

In case the package does not have details (or enough details), the guard may click on 'No User Found'. <br> <br>
<img width="1710" alt="Screenshot 2025-02-19 at 12 28 39 AM" src="https://github.com/user-attachments/assets/bb2768af-8e91-4a3c-b292-79a45252c144" /> <br> <br>
This takes them to a page to enter the tracking ID of the package instead. <br> <br>
<img width="1710" alt="Screenshot 2025-02-19 at 12 24 30 AM" src="https://github.com/user-attachments/assets/63734603-9d8b-458c-9c40-2da8164fb969" /> <br> <br>
<br>
In both the above cases, the guard selects the delivery partner per usual and logs the package. A success page is rendered with the following specifications: <br>
1. Package No. : This is generated serially. For exampl, the 16th package of the day has PackageNo. = 16. (This is how their current system works as well) <br>
2. Shelf No. : This is generated based on the first letter of the student's name. For example, for Ibrahim, it is I. (This is how their current system works as well) <br>
3. Timestamp: Shows them the current date and time. They write the day and month on the package for logging purposes. <br>



