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
     * @return {Object} Response data
     */
    makeApiRequest(endpoint, method, payload = null) {
      try {
        const url = this.baseUrl + endpoint;

        const options = {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          muteHttpExceptions: true
        };

        // Add authentication if token is available
        if (this.apiToken) {
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
     * Performs user authentication and gets token
     * @param {string} email - User email
     * @param {string} password - User password
     * @return {Object} Auth response with token
     */
    authenticate(email, password) {
      try {
        const endpoint = '/api/verify-password';
        const payload = { email, password };

        const response = this.makeApiRequest(endpoint, 'post', payload);

        if (!response.success || !response.token) {
          throw new Error(response.error || 'Authentication failed');
        }

        // Set the token for subsequent requests
        this.setToken(response.token);

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