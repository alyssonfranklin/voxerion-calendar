/**
 * Database Manager for the Voxerion application.
 * Handles interactions with Google Sheets as a database.
 * Provides methods for creating and accessing database tables.
 * 
 * @class DatabaseManager
 */
class DatabaseManager {
  constructor() {
    this.spreadsheet = SpreadsheetApp.openById(AUTH_CONFIG.DB_SPREADSHEET_ID);
  }
  
  initializeDatabase() {
    // Create Companies sheet
    this.createCompaniesSheet();
    
    // Create Users sheet
    this.createUsersSheet();
    
    // Create Department sheet
    this.createDepartmentSheet();
    
    // Create Employee sheet
    this.createEmployeeSheet();
    
    // Create Access Tokens sheet
    this.createAccessTokensSheet();
    
    // Add data validation and protection
    this.setupDataValidation();
  }
  
  createCompaniesSheet() {
    let sheet = this.spreadsheet.getSheetByName('Companies');
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet('Companies');
      
      // Set headers
      const headers = [
        'company_id',
        'name',
        'assistant_id',
        'status',
        'created_at',
        'updated_at'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#D3D3D3')
        .setFontWeight('bold');
        
      // Add data validation for status
      const statusRange = sheet.getRange(2, 5, sheet.getMaxRows() - 1);
      const statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['active', 'inactive', 'suspended'])
        .build();
      statusRange.setDataValidation(statusRule);
    }
  }

  createUsersSheet() {
    let sheet = this.spreadsheet.getSheetByName('Users');
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet('Users');
      
      // Set headers
      const headers = [
        'id',
        'email',
        'name',
        'company_id',
        'system_role',
        'last_access',
        'department',
        'company_role'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#D3D3D3')
        .setFontWeight('bold');
        
      // Add data validation for system_role (column 5)
      const roleRange = sheet.getRange(2, 5, sheet.getMaxRows() - 1);
      const roleRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['admin', 'user'])
        .build();
      roleRange.setDataValidation(roleRule);
    }
  }
  createDepartmentSheet() {
    let sheet = this.spreadsheet.getSheetByName('Departments');
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet('Departments');
      
      // Set headers
      const headers = [
        'company_id',
        'department_name',
        'department_desc',
        'user_head'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#D3D3D3')
        .setFontWeight('bold');
        
      // No specific validation needed for user_head as it should be an email or user ID
    }
  }
  createEmployeeSheet() {
    let sheet = this.spreadsheet.getSheetByName('Employees');
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet('Employees');
      
      // Set headers
      const headers = [
        'employee_id',
        'employee_name',
        'employee_role',
        'employee_leader'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#D3D3D3')
        .setFontWeight('bold');
        
      // Add data validation for employee_role (column 3)
      const roleRange = sheet.getRange(2, 3, sheet.getMaxRows() - 1);
      const roleRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['manager', 'team_lead', 'employee'])
        .build();
      roleRange.setDataValidation(roleRule);
      
      // No specific validation for employee_leader as it should reference another employee_id
    }
  }

  createAccessTokensSheet() {
    let sheet = this.spreadsheet.getSheetByName('AccessTokens');
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet('AccessTokens');
      
      // Set headers
      const headers = [
        'token',
        'user_id',
        'expires_at'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#D3D3D3')
        .setFontWeight('bold');
    }
  }

  setupDataValidation() {
    // Add data validation and protection as needed
    const protection = this.spreadsheet.protect();
    protection.setDescription('Database Schema Protection');
    protection.addEditor(Session.getEffectiveUser());
  }
}

/**
 * Get or create the database spreadsheet.
 * Caches the spreadsheet reference for better performance.
 * 
 * @return {Spreadsheet} The database spreadsheet.
 */
function getDatabaseSpreadsheet() {
  // Create an instance of DatabaseManager
  const dbManager = new DatabaseManager();
  return dbManager.spreadsheet;
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
  const sheet = spreadsheet.getSheetByName('Insights') || 
                spreadsheet.insertSheet('Insights');
  
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
    
    if (!sheet) return false;
    
    // Get the first column containing event IDs
    const eventIdColumn = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
    
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
  const sheet = spreadsheet.getSheetByName('Context') ||
                spreadsheet.insertSheet('Context');
  
  // Set up headers if new sheet
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Email', 'Name', 'Role', 'Team', 'Prior Meetings', 'Notes', 'Last Updated']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  
  // Find if the email already exists
  const emailColumn = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
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