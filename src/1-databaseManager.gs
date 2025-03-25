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
        console.log(`Searching for user with email: ${email}`);
        
        // First, let's try to authenticate using our multi-strategy approach
        const authSuccess = this.db.tryAuth();
        console.log(`Authentication status: ${authSuccess ? 'SUCCESS' : 'FAILED'}`);
        
        // Once we've tried authentication, attempt to use available API endpoints
        
        // List of possible user endpoint patterns to try
        const userEndpoints = [
          // Direct user lookup endpoints
          { path: `/api/users/by-email/${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/users/email/${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/users/find/${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/users/lookup/${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/user/${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/user/email/${encodeURIComponent(email)}`, method: 'get' },
          
          // Query parameter endpoints
          { path: `/api/users?email=${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/users?filter=email:${encodeURIComponent(email)}`, method: 'get' },
          { path: `/api/users?q=${encodeURIComponent(email)}`, method: 'get' },
          
          // POST endpoints for user lookup
          { path: `/api/users/find`, method: 'post', payload: { email: email } },
          { path: `/api/users/search`, method: 'post', payload: { email: email } },
          { path: `/api/users/lookup`, method: 'post', payload: { email: email } },
        ];
        
        console.log(`Trying ${userEndpoints.length} different API endpoints...`);
        // Try each endpoint
        for (const endpoint of userEndpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint.path} (${endpoint.method})`);
            
            const useAuth = this.db.getToken() && this.db.getToken().length > 0;
            console.log(`Using auth: ${useAuth}`);
            
            let response;
            if (endpoint.method === 'get') {
              response = this.db.makeApiRequest(endpoint.path, endpoint.method, null, !useAuth);
            } else {
              response = this.db.makeApiRequest(endpoint.path, endpoint.method, endpoint.payload, !useAuth);
            }
            
            // Try to extract user from various response formats
            let user = null;
            
            if (response && response.data && !Array.isArray(response.data)) {
              user = response.data;
            } else if (response && Array.isArray(response.data) && response.data.length > 0) {
              user = response.data[0];
            } else if (response && response.user) {
              user = response.user;
            } else if (response && !response.data && !response.users && Object.keys(response).length > 0) {
              // If the response itself looks like a user object
              if (response.email && (response.id || response._id)) {
                user = response;
              }
            } else if (response && response.users && Array.isArray(response.users) && response.users.length > 0) {
              user = response.users[0];
            }
            
            if (user) {
              console.log(`Found user with endpoint: ${endpoint.path}`);
              // Cache the result for 30 minutes
              this.cache.put(cacheKey, JSON.stringify(user), 1800);
              return user;
            }
          } catch (endpointError) {
            console.log(`Endpoint ${endpoint.path} failed: ${endpointError.message}`);
            // Continue trying other endpoints
          }
        }
        
        // If we got here, all endpoints failed
        console.log('All API endpoints failed to find the user');
        
        // Last resort: try a generic search through all users
        if (this.db.getToken()) {
          try {
            console.log('Trying to search through all users...');
            const allUsers = this.db.getEntities('users');
            
            if (Array.isArray(allUsers)) {
              const foundUser = allUsers.find(user => 
                user.email === email || 
                user.email.toLowerCase() === email.toLowerCase()
              );
              
              if (foundUser) {
                console.log('Found user by manually filtering all users');
                // Cache the result for 30 minutes
                this.cache.put(cacheKey, JSON.stringify(foundUser), 1800);
                return foundUser;
              }
            }
          } catch (allUsersError) {
            console.log('Error searching through all users:', allUsersError);
          }
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
