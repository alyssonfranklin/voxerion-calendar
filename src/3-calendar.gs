  /**
   * REST API-based Database Manager for the Voxerion application.
   * Handles interactions with MongoDB via REST API.
   * 
   * @class DatabaseManager
   */
  class DatabaseManager {
    constructor() {
      this.baseUrl = "https://kantor-onboarding-alysson-franklins-projects.vercel.app";
      this.apiToken = "";
      
      // Try to load a saved token from cache
      try {
        const cache = CacheService.getUserCache();
        const savedToken = cache.get('VOXERION_API_TOKEN');
        if (savedToken) {
          this.apiToken = savedToken;
          console.log('Loaded saved token from cache');
        }
      } catch (e) {
        console.log('No saved token found in cache');
      }
    }

    /**
     * Sets the API token for authentication
     * @param {string} token - JWT token for API authentication
     */
    setToken(token) {
      this.apiToken = token;
    }

    /**
     * Gets the current API token
     * @return {string} The current API token
     */
    getToken() {
      return this.apiToken;
    }

    /**
     * Makes an authenticated API request to the MongoDB backend
     * @param {string} endpoint - API endpoint path (e.g., '/api/users')
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {Object} payload - Data to send (for POST/PUT)
     * @param {boolean} noAuth - If true, don't add authorization header even if token exists
     * @return {Object} Response data
     */
    makeApiRequest(endpoint, method, payload = null, noAuth = false) {
      try {
        const url = this.baseUrl + endpoint;

        const options = {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          muteHttpExceptions: true
        };

        // Add authentication if token is available and auth is required
        if (!noAuth && this.apiToken) {
          options.headers['Authorization'] = `Bearer ${this.apiToken}`;
        }

        // Add payload for POST/PUT
        if (payload && (method === 'post' || method === 'put')) {
          options.payload = JSON.stringify(payload);
        }

        console.log(`Making ${method.toUpperCase()} request to ${endpoint}`);
        const response = UrlFetchApp.fetch(url, options);

        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        console.log(`Response code: ${responseCode}`);

        if (responseCode >= 400) {
          if (responseCode === 401 && !noAuth) {
            // Token might be expired, clear it
            this.apiToken = "";
            const cache = CacheService.getUserCache();
            cache.remove('VOXERION_API_TOKEN');
          }
          
          console.error(`API Error: ${responseText}`);
          throw new Error(`API Error (${responseCode}): ${responseText}`);
        }

        return JSON.parse(responseText);
      } catch (error) {
        console.error(`Error making API request to ${endpoint}:`, error);
        throw error;
      }
    }

    /**
     * Gets all entities from a collection
     * @param {string} entityType - Type of entity (users, companies, departments, employees)
     * @param {Object} filters - Query parameters for filtering
     * @return {Array} Array of entities
     */
    getEntities(entityType, filters = {}) {
      try {
        // Build query string from filters
        const queryParams = [];
        for (const key in filters) {
          if (filters.hasOwnProperty(key) && filters[key] !== null && filters[key] !== undefined) {
            queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(filters[key])}`);
          }
        }

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const endpoint = `/api/${entityType}${queryString}`;

        const response = this.makeApiRequest(endpoint, 'get');

        if (!response.success) {
          throw new Error(response.message || `Failed to get ${entityType}`);
        }

        return response.data || [];
      } catch (error) {
        console.error(`Error in getEntities for ${entityType}:`, error);
        throw error;
      }
    }

    /**
     * Gets a single entity by ID
     * @param {string} entityType - Type of entity (users, companies, departments, employees)
     * @param {string} id - Entity ID
     * @return {Object} Entity data
     */
    getEntityById(entityType, id) {
      try {
        const endpoint = `/api/${entityType}/${id}`;
        const response = this.makeApiRequest(endpoint, 'get');

        if (!response.success) {
          throw new Error(response.message || `Entity not found: ${entityType} ${id}`);
        }

        return response.data;
      } catch (error) {
        console.error(`Error in getEntityById for ${entityType}:`, error);
        return null;
      }
    }

    /**
     * Creates a new entity
     * @param {string} entityType - Type of entity (users, companies, departments, employees)
     * @param {Object} data - Entity data
     * @return {Object} Created entity data
     */
    createEntity(entityType, data) {
      try {
        const endpoint = `/api/${entityType}`;
        const response = this.makeApiRequest(endpoint, 'post', data);

        if (!response.success) {
          throw new Error(response.message || `Failed to create ${entityType}`);
        }

        return response.data;
      } catch (error) {
        console.error(`Error in createEntity for ${entityType}:`, error);
        throw error;
      }
    }

    /**
     * Updates an existing entity
     * @param {string} entityType - Type of entity (users, companies, departments, employees)
     * @param {string} id - Entity ID
     * @param {Object} data - Updated entity data
     * @return {Object} Updated entity data
     */
    updateEntity(entityType, id, data) {
      try {
        const endpoint = `/api/${entityType}/${id}`;
        const response = this.makeApiRequest(endpoint, 'put', data);

        if (!response.success) {
          throw new Error(response.message || `Failed to update ${entityType}`);
        }

        return response.data;
      } catch (error) {
        console.error(`Error in updateEntity for ${entityType}:`, error);
        throw error;
      }
    }

    /**
     * Deletes an entity
     * @param {string} entityType - Type of entity (users, companies, departments, employees)
     * @param {string} id - Entity ID
     * @return {boolean} Success status
     */
    deleteEntity(entityType, id) {
      try {
        const endpoint = `/api/${entityType}/${id}`;
        const response = this.makeApiRequest(endpoint, 'delete');

        return response.success === true;
      } catch (error) {
        console.error(`Error in deleteEntity for ${entityType}:`, error);
        return false;
      }
    }
    
    /**
     * Gets company by domain more efficiently using a dedicated endpoint
     * @param {string} domain - Domain to search for
     * @return {Object|null} Company data or null if not found
     */
    getCompanyByDomain(domain) {
      try {
        // Use a dedicated endpoint for domain lookup if available
        const endpoint = `/api/companies/domain/${domain}`;
        
        try {
          const response = this.makeApiRequest(endpoint, 'get');
          
          if (response.success && response.data) {
            return response.data;
          }
        } catch (directEndpointError) {
          console.log('Dedicated domain endpoint not available:', directEndpointError);
          // Fall back to using filters via the standard endpoint if dedicated endpoint fails
        }
        
        // Fall back to using the standard endpoint with a domain query parameter
        return this.getEntities('companies', { domain: domain })[0] || null;
      } catch (error) {
        console.error(`Error in getCompanyByDomain for ${domain}:`, error);
        return null;
      }
    }
    
    /**
     * Checks if a user exists by email using a dedicated public endpoint
     * @param {string} email - Email address to check
     * @return {Object|null} User data if found, or null
     */
    checkUserExists(email) {
      try {
        if (!email) return null;
        
        const endpoint = `/api/users/exists/${encodeURIComponent(email)}`;
        
        // Try as public endpoint first
        try {
          const response = this.makeApiRequest(endpoint, 'get', null, true);
          
          if (response.success) {
            if (response.exists === false) {
              // User explicitly doesn't exist
              return null;
            }
            
            // If the endpoint returns the user data directly
            if (response.data) {
              return response.data;
            }
          }
        } catch (error) {
          console.log('User exists check endpoint not available:', error);
        }
        
        // Fallback to regular lookup via guest token
        if (this.guestToken) {
          const savedToken = this.apiToken;
          
          try {
            this.setToken(this.guestToken);
            const users = this.getEntities('users', { email: email, limit: 1 });
            
            if (users && users.length > 0) {
              return users[0];
            }
            
            return null;
          } finally {
            this.setToken(savedToken);
          }
        }
        
        return null;
      } catch (error) {
        console.error(`Error checking if user exists: ${email}`, error);
        return null;
      }
    }

    /**
     * Performs user authentication and gets token
     * @param {string} email - User email
     * @param {string} password - User password
     * @return {Object} Auth response with token
     */
    authenticate(email, password) {
      try {
        const endpoint = '/api/auth/login';
        const payload = { email, password };

        // This endpoint doesn't require authentication
        const response = this.makeApiRequest(endpoint, 'post', payload, true);

        if (!response.token) {
          throw new Error(response.message || 'Authentication failed');
        }

        // Set the token for subsequent requests
        this.setToken(response.token);
        
        // Save the token in cache for future use
        const cache = CacheService.getUserCache();
        cache.put('VOXERION_API_TOKEN', response.token, 60 * 60); // 1 hour expiry

        return {
          token: response.token,
          user: response.user
        };
      } catch (error) {
        console.error('Authentication error:', error);
        throw error;
      }
    }
    
    /**
     * Try public authentication with default credentials
     * This is a fallback method when the user isn't logged in
     * @return {boolean} True if authentication successful
     */
    tryDefaultAuth() {
      try {
        // Check if we already have a token
        if (this.apiToken) {
          // Try to validate it
          try {
            this.getEntities('users', { limit: 1 });
            // If no error, token is valid
            return true;
          } catch (e) {
            // Token is invalid, clear it
            this.apiToken = "";
          }
        }
        
        const defaultCredentials = {
          email: 'guest@voxerion.com',
          password: 'voxerion123'
        };
        
        this.authenticate(defaultCredentials.email, defaultCredentials.password);
        return true;
      } catch (error) {
        console.warn('Could not authenticate with default credentials:', error);
        return false;
      }
    }

    /**
     * Invalidates the current token (logout)
     * @return {boolean} Success status
     */
    invalidateToken() {
      try {
        if (!this.apiToken) {
          return true; // Already logged out
        }

        const endpoint = '/api/logout';
        const response = this.makeApiRequest(endpoint, 'post');

        // Clear the token regardless of response
        this.apiToken = '';

        return response.success === true;
      } catch (error) {
        console.error('Error invalidating token:', error);
        // Clear token even if there's an error
        this.apiToken = '';
        return false;
      }
    }
  }

  /**
   * Get or create the database manager.
   * Returns an instance of the API-based DatabaseManager.
   * 
   * @return {DatabaseManager} The database manager instance.
   */
  function getDatabaseManager() {
    return new DatabaseManager();
  }