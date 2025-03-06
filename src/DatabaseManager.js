class DatabaseManager {
  constructor() {
    this.spreadsheet = SpreadsheetApp.openById(AUTH_CONFIG.DB_SPREADSHEET_ID);
  }

  initializeDatabase() {
    // Create Companies sheet
    this.createCompaniesSheet();
    
    // Create Users sheet
    this.createUsersSheet();
    
    // Create Access Tokens sheet
    this.createAccessTokensSheet();
    
    // Add data validation and protection
    this.setupDataValidation();
  }

  getUserAccessDetails(email) {
      try {
        const user = this.dbOps.getUserByEmail(email);
        if (!user) {
          throw new Error('User not found');
        }

        const company = this.dbOps.getCompanyByDomain(email.split('@')[1]);
        if (!company) {
          throw new Error('Company not registered');
        }

        console.log('User Email:', email);
        console.log('Company Details:', JSON.stringify(company, null, 2));
        console.log('Assistant ID from DB:', company.assistant_id);

        return {
          userId: user.id,
          companyId: company.id,
          assistantId: company.assistant_id,
          role: user.role,
          status: company.status
        };
      } catch (error) {
        console.error('Error getting user access details:', error);
        throw error;
      }
  }
  
  createCompaniesSheet() {
    let sheet = this.spreadsheet.getSheetByName('Companies');
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet('Companies');
      
      // Set headers
      const headers = [
        'id',
        'name',
        'domain',
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
        'company_id',
        'role',
        'last_access'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#D3D3D3')
        .setFontWeight('bold');
        
      // Add data validation for role
      const roleRange = sheet.getRange(2, 4, sheet.getMaxRows() - 1);
      const roleRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['admin', 'user'])
        .build();
      roleRange.setDataValidation(roleRule);
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