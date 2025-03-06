class DatabaseOperations {
  constructor() {
    this.db = new DatabaseManager();
  }

  // Company operations
  createCompany(company) {
    const sheet = this.db.spreadsheet.getSheetByName('Companies');
    const now = new Date().toISOString();
    
    const companyData = [
      Utilities.getUuid(),
      company.name,
      company.assistant_id,
      'active',
      now,
      now
    ];
    
    sheet.appendRow(companyData);
    return companyData[0]; // Return the generated ID
  }

 getCompanyById(companyId) {
    console.log('Looking for company with ID:', companyId);
    const sheet = this.db.spreadsheet.getSheetByName('Companies');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    console.log('Company headers:', headers);
    
    // Changed from 'id' to 'company_id' to match your database structure
    const idIndex = headers.indexOf('company_id');
    console.log('Company ID column index:', idIndex);
    
    /* // Log all companies for debugging
    data.forEach((row, index) => {
      if (index > 0) {
        console.log(`Row ${index}: ID = ${row[idIndex]}, Assistant ID = ${row[headers.indexOf('assistant_id')]}`);
      }
    }); */
    
    const company = data.find((row, index) => index > 0 && row[idIndex] === companyId);
    
    if (!company) {
      console.log('No company found for ID:', companyId);
      return null;
    }
    
    const result = this.rowToObject(company, headers);
    console.log('Found company:', JSON.stringify(result));
    return result;
}

  // User operations
  createUser(user) {
    const sheet = this.db.spreadsheet.getSheetByName('Users');
    const userData = [
      Utilities.getUuid(),
      user.email,
      user.company_id,
      user.role || 'user',
      new Date().toISOString()
    ];
    
    sheet.appendRow(userData);
    return userData[0]; // Return the generated ID
  }

  getUserByEmail(email) {
    const sheet = this.db.spreadsheet.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('Looking for email:', email);
    console.log('Headers:', headers);
    
    const emailIndex = headers.indexOf('email');
    console.log('Email column index:', emailIndex);
    
   /* // Log all users for debugging
    data.forEach((row, index) => {
      if (index > 0) { // Skip header row
        console.log(`Row ${index}: Email = ${row[emailIndex]}`);
      }
    }); */
    
    const user = data.find((row, index) => index > 0 && row[emailIndex] === email);
    
    if (!user) {
      console.log('No user found with email:', email);
      return null;
    }
    
    const result = this.rowToObject(user, headers);
    console.log('Found user:', JSON.stringify(result));
    return result;
}

  // Access token operations
  createAccessToken(userId, expiresAt) {
    const sheet = this.db.spreadsheet.getSheetByName('AccessTokens');
    const tokenData = [
      Utilities.getUuid(),
      userId,
      expiresAt.toISOString()
    ];
    
    sheet.appendRow(tokenData);
    return tokenData[0]; // Return the generated token
  }

  validateAccessToken(token) {
    const sheet = this.db.spreadsheet.getSheetByName('AccessTokens');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const tokenIndex = headers.indexOf('token');
    const expiresIndex = headers.indexOf('expires_at');
    
    const tokenRow = data.find((row, index) => {
      if (index === 0) return false;
      return row[tokenIndex] === token && new Date(row[expiresIndex]) > new Date();
    });
    
    return !!tokenRow;
  }

  // Utility method to convert row data to object
  rowToObject(row, headers) {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  }
}

// Database utility functions for the application
class VoxerionDatabase {
  constructor() {
    this.dbOps = new DatabaseOperations();
  }

  getUserAccessDetails(email) {
    try {
      console.log('Getting access details for email:', email);
      
      // Get user by exact email match
      const user = this.dbOps.getUserByEmail(email);
      if (!user) {
        console.log('User not found for email:', email);
        throw new Error('User not found');
      }
      console.log('Found user:', JSON.stringify(user));

      // Get company using user's company_id
      const company = this.dbOps.getCompanyById(user.company_id);
      if (!company) {
        console.log('Company not found for id:', user.company_id);
        throw new Error('Company not found');
      }
      console.log('Found company:', JSON.stringify(company));
      console.log('Using Assistant ID:', company.assistant_id);

      return {
        userId: user.id,
        companyId: company.id,
        assistantId: company.assistant_id,
        role: user.system_role,
        status: company.status
      };
    } catch (error) {
      console.error('Error getting user access details:', error);
      throw error;
    }
  }

  createAccessToken(email) {
    try {
      const user = this.dbOps.getUserByEmail(email);
      if (!user) {
        // Create new user if doesn't exist
        const company = this.dbOps.getCompanyByDomain(email.split('@')[1]);
        if (!company) {
          throw new Error('Company not registered');
        }

        const userId = this.dbOps.createUser({
          email: email,
          company_id: company.id,
          role: 'user'
        });

        // Create access token
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry
        
        return this.dbOps.createAccessToken(userId, expiresAt);
      }

      // Create access token for existing user
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      
      return this.dbOps.createAccessToken(user.id, expiresAt);
    } catch (error) {
      console.error('Error creating access token:', error);
      throw error;
    }
  }

  validateToken(token) {
    try {
      return this.dbOps.validateAccessToken(token);
    } catch (error) {
      console.error('Error validating token:', error);
      throw error;
    }
  }
}