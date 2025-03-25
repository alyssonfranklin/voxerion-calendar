/**
   * Database operations class for the Voxerion application.
   * Provides CRUD operations for company, user, and access token data.
   * Uses the MongoDB-backed REST API database manager.
   * 
   * @class DatabaseOperations
   */
  class DatabaseOperations {
    constructor() {
      this.db = getDatabaseManager();
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
      try {
        const now = new Date().toISOString();

        const companyData = {
          name: company.name,
          assistant_id: company.assistant_id,
          status: 'active',
          created_at: now,
          updated_at: now
        };

        const result = this.db.createEntity('companies', companyData);
        return result.company_id;
      } catch (error) {
        console.error('Error creating company:', error);
        return null;
      }
    }

    /**
     * Gets a company by its ID
     * 
     * @param {string} companyId - Company ID to look up
     * @return {Object|null} Company data object or null if not found
     */
    getCompanyById(companyId) {
      console.log('Looking for company with ID:', companyId);

      try {
        return this.db.getEntityById('companies', companyId);
      } catch (error) {
        console.error('Error getting company by ID:', error);
        return null;
      }
    }

    /**
     * Gets a company by domain
     * 
     * @param {string} domain - Domain to look up
     * @return {Object|null} Company data or null if not found
     */
    getCompanyByDomain(domain) {
      if (!domain) {
        console.error('Invalid domain parameter');
        return null;
      }

      try {
        console.log('Looking for company with domain:', domain);
        
        // Use the dedicated method in DatabaseManager if available
        if (typeof this.db.getCompanyByDomain === 'function') {
          const company = this.db.getCompanyByDomain(domain);
          if (company) {
            console.log('Found company using dedicated endpoint');
            return company;
          }
        }
        
        // If the dedicated method is not available or found no results,
        // fall back to filtering with query parameters
        
        // Try direct domain property first
        const companies = this.db.getEntities('companies', { domain: domain });
        if (companies && companies.length > 0) {
          console.log('Found company by direct domain query');
          return companies[0];
        }
        
        // Try domains array next
        try {
          const arrayCompanies = this.db.getEntities('companies', { 'domains': domain });
          if (arrayCompanies && arrayCompanies.length > 0) {
            console.log('Found company by domains array query');
            return arrayCompanies[0];
          }
        } catch (arrayQueryError) {
          console.log('Domains array query did not return results:', arrayQueryError);
        }
        
        // Last resort - client-side filtering
        console.log('Falling back to client-side filtering');
        const allCompanies = this.db.getEntities('companies');
        
        return allCompanies.find(company => {
          // Check domain property
          if (company.domain === domain) return true;
          
          // Check domains array property
          if (Array.isArray(company.domains) && company.domains.includes(domain)) return true;
          
          return false;
        }) || null;
      } catch (error) {
        console.error('Error getting company by domain:', error);
        return null;
      }
    }

    /**
     * Creates a new user in the database
     * 
     * @param {Object} user - User data
     * @return {string} Generated user ID
     */
    createUser(user) {
      try {
        const userData = {
          email: user.email,
          name: user.name || '',
          company_id: user.company_id,
          role: user.role || 'user',
          created_at: new Date().toISOString(),
          department: user.department || '',
          company_role: user.company_role || '',
          password: user.password || 'defaultpassword' // You should generate a secure password
        };

        const result = this.db.createEntity('users', userData);
        return result.id;
      } catch (error) {
        console.error('Error creating user:', error);
        return null;
      }
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
            // Continue to fetch from API
          }
        }
      } else {
        console.log('Skipping cache for email lookup:', email);
      }

      try {
        // Try to use existing authentication if available
        try {
          if (this.db.getToken()) {
            // Attempt to get user with the current token
            const users = this.db.getEntities('users', { email: email });
            
            if (users && users.length > 0) {
              const user = users[0];
              console.log('Found user with existing token');
              // Cache the result for 30 minutes
              this.cache.put(cacheKey, JSON.stringify(user), 1800);
              return user;
            }
          }
        } catch (authError) {
          console.log('Error finding user with existing token:', authError);
        }
        
        // Try to authenticate with default credentials as a fallback
        if (this.db.tryDefaultAuth()) {
          console.log('Authenticated with default credentials, trying again');
          
          try {
            // Now try again with the new token
            const users = this.db.getEntities('users', { email: email });
            
            if (users && users.length > 0) {
              const user = users[0];
              console.log('Found user after default authentication');
              // Cache the result for 30 minutes
              this.cache.put(cacheKey, JSON.stringify(user), 1800);
              return user;
            }
          } catch (retryError) {
            console.log('Error finding user after default authentication:', retryError);
          }
        }
        
        // If all authentication attempts fail, try a simple email lookup
        // without any query parameters (directly on the API path)
        try {
          const endpoint = `/api/users/email/${encodeURIComponent(email)}`;
          const response = this.db.makeApiRequest(endpoint, 'get', null, true);
          
          if (response && response.data) {
            const user = response.data;
            console.log('Found user with direct email endpoint');
            // Cache the result for 30 minutes
            this.cache.put(cacheKey, JSON.stringify(user), 1800);
            return user;
          }
        } catch (directApiError) {
          console.log('Direct API lookup failed:', directApiError);
        }
        
        // If we reach here, we couldn't find the user
        console.log('No user found with email:', email);
        // If we didn't find the user, remove any cached version
        this.cache.remove(cacheKey);
        return null;
      } catch (error) {
        console.error('Error getting user by email:', error);
        return null;
      }
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

    /**
     * Creates an access token for a user
     * 
     * @param {string} userId - User ID
     * @param {Date} expiresAt - Token expiration date
     * @return {string} Generated token
     */
    createAccessToken(userId, expiresAt) {
      try {
        // In the new system, tokens are generated on login, not created separately
        // We'll perform a login operation for the user instead

        // First, get the user details to get their email
        const user = this.db.getEntityById('users', userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Then authenticate to get a token
        // Note: This would require knowing the user's password
        // In practice, you might need a different approach
        // This is a placeholder implementation

        const authResponse = this.db.authenticate(user.email, user.password || 'defaultpassword');
        return authResponse.token;
      } catch (error) {
        console.error('Error creating access token:', error);
        return null;
      }
    }

    /**
     * Validates an access token
     * 
     * @param {string} token - Token to validate
     * @return {boolean} Whether the token is valid
     */
    validateAccessToken(token) {
      try {
        // Set the token to be used for validation
        this.db.setToken(token);

        // Try to make a simple authenticated request
        // If it succeeds, the token is valid
        const response = this.db.getEntities('users', { limit: 1 });

        return true; // If we got here, the token is valid
      } catch (error) {
        console.error('Error validating token:', error);
        return false;
      }
    }
  }

  /**
   * Main database interface for the Voxerion application.
   * Provides methods for user authentication, access control, and data management.
   * Uses MongoDB-backed API database operations.
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
          role: user.role,
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

    /**
     * Creates an access token for a user
     * 
     * @param {string} email - User's email address
     * @return {string} Generated access token
     */
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

          // Create access token with expiration time
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

    /**
     * Validates an access token
     * 
     * @param {string} token - Token to validate
     * @return {boolean} Whether the token is valid
     */
    validateToken(token) {
      try {
        return this.dbOps.validateAccessToken(token);
      } catch (error) {
        console.error('Error validating token:', error);
        throw error;
      }
    }
  }
