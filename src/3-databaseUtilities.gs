/**
 * Database operations class for the Voxerion application.
 * Provides CRUD operations for company, user, and access token data.
 * 
 * @class DatabaseOperations
 */
class DatabaseOperations {
  constructor() {
    this.db = new DatabaseManager();
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Creates a new company record in the database
   * 
   * @param {Object} company - Company data object
   * @param {string} company.name - Company name
   * @param {string} company.assistant_id - OpenAI Assistant ID for the company
   * @return {string} Generated company ID
   */
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

  /**
   * Finds a user by their email address with cache support
   * 
   * @param {string} email - User's email address
   * @param {boolean} skipCache - If true, bypasses the cache and forces a fresh lookup
   * @return {Object|null} User data object or null if not found
   */
  getUserByEmail(email, skipCache = false) {
    if (!email) {
      console.error('Invalid email parameter');
      return null;
    }
    
    const cacheKey = `USER_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Try to get from cache first (unless skipCache is true)
    if (!skipCache) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        try {
          return JSON.parse(cachedData);
        } catch (e) {
          console.log('Error parsing cached user data:', e);
          // Continue to fetch from sheet
        }
      }
    } else {
      console.log('Skipping cache for email lookup:', email);
    }
    
    // Fetch from sheet if not in cache or skipCache is true
    const sheet = this.db.spreadsheet.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('Looking for email:', email);
    
    const emailIndex = headers.indexOf('email');
    if (emailIndex === -1) {
      console.error('Email column not found in Users sheet');
      return null;
    }
    
    // Use find() for cleaner, more efficient lookup
    const user = data.find((row, index) => index > 0 && row[emailIndex] === email);
    
    if (!user) {
      console.log('No user found with email:', email);
      // If we didn't find the user, remove any cached version
      this.cache.remove(cacheKey);
      return null;
    }
    
    const result = this.rowToObject(user, headers);
    
    // Cache the result for 30 minutes
    this.cache.put(cacheKey, JSON.stringify(result), 1800);
    
    return result;
}

  /**
   * Clears the cache for a specific user
   * 
   * @param {string} email - User's email address
   */
  clearUserCache(email) {
    if (!email) return;
    
    const cacheKey = `USER_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    this.cache.remove(cacheKey);
    console.log('Cache cleared for user:', email);
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

/**
 * Main database interface for the Voxerion application.
 * Provides methods for user authentication, access control, and data management.
 * 
 * @class VoxerionDatabase
 */
class VoxerionDatabase {
  constructor() {
    this.dbOps = new DatabaseOperations();
  }

  /**
   * Gets user access details, including company and assistant information
   * 
   * @param {string} email - User's email address
   * @param {boolean} skipCache - If true, bypasses the cache for a fresh lookup
   * @return {Object|null} User access details or null if not authorized
   */
  getUserAccessDetails(email, skipCache = false) {
    try {
      console.log('Getting access details for email:', email, 'skipCache:', skipCache);
      
      // Get user by exact email match, with optional cache bypass
      const user = this.dbOps.getUserByEmail(email, skipCache);
      if (!user) {
        console.log('User not found for email:', email);
        return null;
      }
      console.log('Found user:', JSON.stringify(user));

      // Get company using user's company_id
      const company = this.dbOps.getCompanyById(user.company_id);
      if (!company) {
        console.log('Company not found for id:', user.company_id);
        return null;
      }
      console.log('Found company:', JSON.stringify(company));
      console.log('Using Assistant ID:', company.assistant_id);

      return {
        userId: user.id,
        companyId: company.company_id,
        assistantId: company.assistant_id,
        role: user.system_role,
        status: company.status
      };
    } catch (error) {
      console.error('Error getting user access details:', error);
      return null;
    }
  }
  
  /**
   * Clears the cache for a specific user
   * 
   * @param {string} email - User's email address
   */
  clearUserCache(email) {
    this.dbOps.clearUserCache(email);
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