// ==============================================================================
// ENNISCORTHY INDIAN ASSOCIATION (EIA)
// Google Apps Script Webhook: Enquiries & Event RSVPs (Multi-Tab Routed)
// ==============================================================================

var SHEET_ID = "1mMdxPxdrZawase1gtK2R7CZhwgHrzxcZ_uCZJ5gDg7E";

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

    var timestamp = new Date();
    var isRsvp = data.type === "event_rsvp" || data.type === "rsvp";

    if (isRsvp) {
      // ══════════════════════════════════════════
      // TAB 2: "Event_RSVPs"
      // ══════════════════════════════════════════
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
          to: "enniscorthyindianassociation@gmail.com",
          subject: "New Event RSVP: " + eventTitle + " (" + guestName + ")",
          body: "New Event RSVP Confirmed:\n\nEvent: " + eventTitle + "\nGuest Name: " + guestName + "\nEmail: " + email + "\nPhone: " + phone + "\nTotal Guests: " + attendees + "\nMember Status: " + memberStatus + "\nNotes: " + notes + "\nDate: " + timestamp.toString()
        });
      } catch (mailErr) {}

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "RSVP recorded in Event_RSVPs tab" }))
        .setMimeType(ContentService.MimeType.JSON);

    } else {
      // ══════════════════════════════════════════
      // TAB 1: "Enquiries"
      // ══════════════════════════════════════════
      var enqSheet = getTab("Enquiries");
      if (enqSheet.getLastRow() === 0) {
        enqSheet.appendRow(["Timestamp", "Name", "Email", "Message", "UserAgent"]);
        enqSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#C59B27").setFontColor("#FFFFFF");
        enqSheet.setFrozenRows(1);
      }

      var name = data.name || "Anonymous";
      var email = data.email || "No email";
      var message = data.message || "";
      var userAgent = data.userAgent || (e && e.postData ? "JSON POST" : "Web Form");

      enqSheet.appendRow([timestamp, name, email, message, userAgent]);

      try {
        MailApp.sendEmail({
          to: "enniscorthyindianassociation@gmail.com",
          subject: "New Website Enquiry from " + name,
          body: "New EIA Website Enquiry:\n\nName: " + name + "\nEmail: " + email + "\nDate: " + timestamp.toString() + "\n\nMessage:\n" + message
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
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", service: "EIA Enquiries & RSVPs Webhook" }))
    .setMimeType(ContentService.MimeType.JSON);
}
