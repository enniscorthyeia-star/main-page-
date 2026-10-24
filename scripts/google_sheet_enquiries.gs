/**
 * GOOGLE APPS SCRIPT: EIA Website Contact Form to Google Sheet
 * 
 * Instructions for User:
 * 1. Open Google Sheets (https://sheets.new) and name it "EIA Enquiries".
 * 2. In the menu, go to: Extensions > Apps Script.
 * 3. Delete any default code in Code.gs, paste this entire file, and click Save (Floppy icon).
 * 4. Click "Deploy" (top right) > "New deployment".
 * 5. Click the Gear icon next to "Select type" and choose "Web app".
 * 6. Set Description: "EIA Website Enquiries Webhook".
 * 7. Set "Execute as": "Me" (your Google account).
 * 8. Set "Who has access": "Anyone" (crucial so website visitors can submit).
 * 9. Click "Deploy", authorize permissions when prompted.
 * 10. Copy the "Web app URL" (starts with https://script.google.com/macros/s/...)
 * 11. Replace GOOGLE_SCRIPT_WEBAPP_URL in index.html with your URL.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s for concurrent writes

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Email", "Message", "IP/UserAgent"]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#C59B27").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    var data;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter || {};
    }

    var timestamp = new Date();
    var name = data.name || "Anonymous";
    var email = data.email || "No email provided";
    var message = data.message || "";
    var userAgent = e.parameter.userAgent || (e.postData ? "JSON POST" : "Web Form");

    // Append enquiry row
    sheet.appendRow([timestamp, name, email, message, userAgent]);

    // Optional: Send instant email alert to EIA Team
    try {
      MailApp.sendEmail({
        to: "enniscorthyindianassociation@gmail.com",
        subject: "New Website Enquiry from " + name,
        body: "Hello EIA Team,\n\nA new enquiry has been submitted through the EIA website:\n\n" +
              "Name: " + name + "\n" +
              "Email: " + email + "\n" +
              "Date: " + timestamp.toLocaleString("en-IE", { timeZone: "Europe/Dublin" }) + "\n\n" +
              "Message:\n" + message + "\n\n" +
              "— EIA Web System"
      });
    } catch (mailErr) {
      Logger.log("Email notification skipped: " + mailErr.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Enquiry submitted successfully"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "EIA Website Contact Form Webhook",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
