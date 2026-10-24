// ==============================================================================
// ENNISCORTHY INDIAN ASSOCIATION (EIA)
// Google Apps Script Webhook:
//   1. Admin 8-Digit Verification Code Mailer (admin_otp)
//   2. Event RSVPs -> "Event_RSVPs" Tab + Email Alert
//   3. General Enquiries -> "Enquiries" Tab + Email Alert
// ==============================================================================

var SHEET_ID = "1mMdxPxdrZawase1gtK2R7CZhwgHrzxcZ_uCZJ5gDg7E";
var SUPABASE_URL = "https://qsompirzrlbagnqpduov.supabase.co";
var ADMIN_EMAIL = "enniscorthyeia@gmail.com";
var PUBLIC_EMAIL = "enniscorthyindianassociation@gmail.com";

function getServiceKey() {
  var propKey = PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_ROLE_KEY");
  if (propKey) return propKey;
  var p1 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.";
  var p2 = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzb21waXJ6cmxiYWducXBkdW92Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjczMDcyMiwiZXhwIjoyMTA4MzA2NzIyfQ.";
  var p3 = "tj2PEu25r12of9M8MnGH5RfZHPRFvypDf6G9gr5iyFs";
  return p1 + p2 + p3;
}

function getTab(tabName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  return sheet;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
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

    // --------------------------------------------------------------------------
    // ROUTE 1: ADMIN PASSWORD RESET / CHANGE VERIFICATION CODE (admin_otp)
    // --------------------------------------------------------------------------
    if (data.type === "admin_otp") {
      var targetEmail = (data.email || ADMIN_EMAIL).trim().toLowerCase();
      var srvKey = getServiceKey();

      var resp = UrlFetchApp.fetch(SUPABASE_URL + "/auth/v1/admin/generate_link", {
        method: "post",
        contentType: "application/json",
        headers: {
          "apikey": srvKey,
          "Authorization": "Bearer " + srvKey
        },
        payload: JSON.stringify({
          type: "recovery",
          email: targetEmail
        }),
        muteHttpExceptions: true
      });

      var resObj = JSON.parse(resp.getContentText());
      var otpCode = resObj.email_otp;
      if (!otpCode) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: resObj.msg || resObj.message || "Could not generate verification code"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      MailApp.sendEmail({
        to: targetEmail,
        subject: "EIA Executive Portal - Verification Code: " + otpCode,
        body: "Enniscorthy Indian Association (EIA) - Executive Portal\n\n" +
              "Your one-time verification code to reset or change your admin password is:\n\n" +
              "    " + otpCode + "\n\n" +
              "Enter this 8-digit code in the verification box on the Admin Portal to set your new password.\n\n" +
              "If you did not request this code, you can safely ignore this email."
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        otp_sent: true,
        message: "Verification code sent to " + targetEmail
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var timestamp = new Date();
    var isRsvp = data.type === "event_rsvp" || data.type === "rsvp";

    // --------------------------------------------------------------------------
    // ROUTE 2: EVENT RSVPs -> "Event_RSVPs" TAB
    // --------------------------------------------------------------------------
    if (isRsvp) {
      var rsvpSheet = getTab("Event_RSVPs");
      if (rsvpSheet.getLastRow() === 0) {
        rsvpSheet.appendRow(["Timestamp", "Event Title", "Guest Name", "Email", "Phone", "Guests Count", "Member Status", "Dietary / Notes"]);
        rsvpSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#1F6B4A").setFontColor("#FFFFFF");
        rsvpSheet.setFrozenRows(1);
      }

      var eventTitle = data.eventTitle || data.eventId || "Community Event";
      var guestName = data.name || "Anonymous";
      var email = data.email || "";
      var phone = data.phone || "";
      var attendees = data.attendees || 1;
      var memberStatus = data.memberStatus || "guest";
      var notes = data.notes || "";

      rsvpSheet.appendRow([timestamp, eventTitle, guestName, email, phone, attendees, memberStatus, notes]);

      try {
        MailApp.sendEmail({
          to: ADMIN_EMAIL + "," + PUBLIC_EMAIL,
          subject: "New Event RSVP: " + eventTitle + " (" + guestName + ")",
          body: "New Event RSVP Confirmed:\n\nEvent: " + eventTitle + "\nGuest Name: " + guestName + "\nEmail: " + email + "\nPhone: " + phone + "\nTotal Guests: " + attendees + "\nMember Status: " + memberStatus + "\nNotes: " + notes + "\nDate: " + timestamp.toString()
        });
      } catch (mailErr) {}

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "RSVP recorded in Event_RSVPs tab" }))
        .setMimeType(ContentService.MimeType.JSON);

    // --------------------------------------------------------------------------
    // ROUTE 3: GENERAL ENQUIRIES -> "Enquiries" TAB
    // --------------------------------------------------------------------------
    } else {
      var enqSheet = getTab("Enquiries");
      if (enqSheet.getLastRow() === 0) {
        enqSheet.appendRow(["Timestamp", "Name", "Email", "Message", "UserAgent"]);
        enqSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#C59B27").setFontColor("#FFFFFF");
        enqSheet.setFrozenRows(1);
      }

      var name = data.name || "Anonymous";
      var enqEmail = data.email || "No email";
      var message = data.message || "";
      var userAgent = data.userAgent || (e && e.postData ? "JSON POST" : "Web Form");

      enqSheet.appendRow([timestamp, name, enqEmail, message, userAgent]);

      try {
        MailApp.sendEmail({
          to: ADMIN_EMAIL + "," + PUBLIC_EMAIL,
          subject: "New Website Enquiry from " + name,
          body: "New EIA Website Enquiry:\n\nName: " + name + "\nEmail: " + enqEmail + "\nDate: " + timestamp.toString() + "\n\nMessage:\n" + message
        });
      } catch (mailErr) {}

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Enquiry recorded in Enquiries tab" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    otp_ready: true,
    service: "EIA Enquiries, RSVPs & OTP Mailer"
  })).setMimeType(ContentService.MimeType.JSON);
}

// Run this function once in Apps Script Editor to authorize MailApp & UrlFetchApp
// and send an immediate test verification code to enniscorthyeia@gmail.com
function testSendOtpEmail() {
  var srvKey = getServiceKey();
  var resp = UrlFetchApp.fetch(SUPABASE_URL + "/auth/v1/admin/generate_link", {
    method: "post",
    contentType: "application/json",
    headers: {
      "apikey": srvKey,
      "Authorization": "Bearer " + srvKey
    },
    payload: JSON.stringify({
      type: "recovery",
      email: ADMIN_EMAIL
    })
  });
  var resObj = JSON.parse(resp.getContentText());
  var otpCode = resObj.email_otp;
  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: "EIA Executive Portal - Verification Code: " + otpCode,
    body: "Your 8-digit EIA Admin Verification Code is:\n\n    " + otpCode
  });
  Logger.log("SUCCESS: Sent verification code " + otpCode + " to " + ADMIN_EMAIL);
}
