var SHEET_ID = "1mMdxPxdrZawase1gtK2R7CZhwgHrzxcZ_uCZJ5gDg7E";

function getSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = getSheet();

    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Email", "Message", "UserAgent"]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#C59B27").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    var data;
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = (e && e.parameter) ? e.parameter : {};
      }
    } else {
      data = (e && e.parameter) ? e.parameter : {};
    }

    var timestamp = new Date();
    var name = data.name || "Anonymous";
    var email = data.email || "No email";
    var message = data.message || "";
    var userAgent = data.userAgent || (e && e.postData ? "JSON POST" : "Web Form");

    sheet.appendRow([timestamp, name, email, message, userAgent]);

    try {
      MailApp.sendEmail({
        to: "enniscorthyindianassociation@gmail.com",
        subject: "New Website Enquiry from " + name,
        body: "New EIA Website Enquiry:\n\nName: " + name + "\nEmail: " + email + "\nDate: " + timestamp.toString() + "\n\nMessage:\n" + message
      });
    } catch (mailErr) {}

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Enquiry recorded" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", service: "EIA Enquiries Webhook" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Manual Test Function to verify authorization in editor
function testSubmit() {
  var sheet = getSheet();
  sheet.appendRow([new Date(), "EIA Test", "test@eiawexford.org", "Manual test from Apps Script Editor", "Editor Run"]);
  Logger.log("SUCCESS: Row added to Google Sheet!");
}
