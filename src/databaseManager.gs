/**
 * Database Manager for the Voxerion application.
 * Handles interactions with Google Sheets as a database.
 */

/**
 * Get or create the database spreadsheet.
 * @return {Spreadsheet} The database spreadsheet.
 */
function getDatabaseSpreadsheet() {
  const SPREADSHEET_NAME = 'Voxerion Calendar Insights Database';
  
  // Try to find existing database
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.open(file);
  }
  
  // Create new database if one doesn't exist
  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  const insightsSheet = spreadsheet.getActiveSheet();
  insightsSheet.setName('Insights');
  
  // Set up headers
  insightsSheet.appendRow([
    'Event ID', 
    'Event Title', 
    'Start Time', 
    'End Time', 
    'Attendees', 
    'Summary', 
    'Key Points', 
    'Suggested Questions', 
    'Created At'
  ]);
  
  // Format headers
  insightsSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  
  // Create context sheet for storing attendee information
  const contextSheet = spreadsheet.insertSheet('Context');
  contextSheet.appendRow(['Email', 'Name', 'Role', 'Team', 'Prior Meetings', 'Notes', 'Last Updated']);
  contextSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  
  return spreadsheet;
}

/**
 * Save event insights to the database.
 * @param {Object} event - The calendar event.
 * @param {Object} insights - The generated insights.
 */
function saveInsightsToDatabase(event, insights) {
  if (!event || !insights) {
    Logger.log('Invalid event or insights data');
    return;
  }
  
  const spreadsheet = getDatabaseSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Insights');
  
  const eventId = event.getId();
  const title = event.getTitle();
  const startTime = event.getStartTime();
  const endTime = event.getEndTime();
  const attendees = event.getGuestList().map(guest => guest.getEmail()).join(', ');
  
  sheet.appendRow([
    eventId,
    title,
    startTime,
    endTime,
    attendees,
    insights.summary,
    insights.keyPoints.join('\n'),
    insights.suggestedQuestions.join('\n'),
    new Date()
  ]);
}

/**
 * Check if insights for an event already exist in the database.
 * @param {String} eventId - The calendar event ID.
 * @return {Boolean} True if insights exist for the event.
 */
function hasInsightsInDatabase(eventId) {
  if (!eventId) return false;
  
  try {
    const spreadsheet = getDatabaseSpreadsheet();
    const sheet = spreadsheet.getSheetByName('Insights');
    
    // Get the first column containing event IDs
    const eventIdColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    
    // Check if the eventId exists
    for (let i = 0; i < eventIdColumn.length; i++) {
      if (eventIdColumn[i][0] === eventId) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    Logger.log('Error checking database: ' + error.toString());
    return false;
  }
}

/**
 * Update the context database with attendee information.
 * @param {String} email - Attendee's email.
 * @param {Object} contextData - Context data to save.
 */
function updateAttendeeContext(email, contextData) {
  if (!email || !contextData) return;
  
  const spreadsheet = getDatabaseSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Context');
  
  // Find if the email already exists
  const emailColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let rowIndex = -1;
  
  for (let i = 0; i < emailColumn.length; i++) {
    if (emailColumn[i][0] === email) {
      rowIndex = i + 2; // +2 because arrays are 0-indexed and row 1 is headers
      break;
    }
  }
  
  if (rowIndex === -1) {
    // Add new row
    sheet.appendRow([
      email,
      contextData.name || '',
      contextData.role || '',
      contextData.team || '',
      contextData.priorMeetings || '',
      contextData.notes || '',
      new Date()
    ]);
  } else {
    // Update existing row
    sheet.getRange(rowIndex, 2).setValue(contextData.name || sheet.getRange(rowIndex, 2).getValue());
    sheet.getRange(rowIndex, 3).setValue(contextData.role || sheet.getRange(rowIndex, 3).getValue());
    sheet.getRange(rowIndex, 4).setValue(contextData.team || sheet.getRange(rowIndex, 4).getValue());
    sheet.getRange(rowIndex, 5).setValue(contextData.priorMeetings || sheet.getRange(rowIndex, 5).getValue());
    sheet.getRange(rowIndex, 6).setValue(contextData.notes || sheet.getRange(rowIndex, 6).getValue());
    sheet.getRange(rowIndex, 7).setValue(new Date());
  }
}