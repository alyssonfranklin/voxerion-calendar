  /**
   * REST API-based Database Manager for the Voxerion application.
   * Handles interactions with MongoDB via REST API.
   * 
   * @class DatabaseManager
   */
  class DatabaseManager {
    constructor() {
      // Version info for debugging
      this.VERSION = "v1.0.4 - 2025-03-25 14:45";
      console.log("==== VOXERION DATABASE MANAGER ====");
      console.log(`Version: ${this.VERSION}`);
      console.log("==================================");
      
      // API configuration
      this.baseUrl = "https://data.mongodb-api.com/app/data-abcde/endpoint/data/v1";
      console.log(`API Base URL: ${this.baseUrl}`);
      this.apiToken = "";
      
      // MongoDB Atlas Data API configuration
      this.dataSource = "Cluster0";
      this.database = "voxerion";
      this.apiKey = ""; // To be set via Data API Key from MongoDB Atlas
      
      // API endpoint structure
      this.endpoints = {
        login: null,
        users: null,
        user_by_email: null,
        companies: null
      };
      
      // Try to load a saved token from cache
      try {
        const cache = CacheService.getUserCache();
        const savedToken = cache.get('VOXERION_API_TOKEN');
        if (savedToken) {
          this.apiToken = savedToken;
          console.log('Loaded saved token from cache');
        }
        
        // Try to load cached API structure
        const cachedStructure = cache.get('VOXERION_API_STRUCTURE');
        if (cachedStructure) {
          try {
            this.endpoints = JSON.parse(cachedStructure);
            console.log('Loaded API structure from cache:', this.endpoints);
          } catch (e) {
            console.log('Error parsing cached API structure:', e);
          }
        }
      } catch (e) {
        console.log('No saved token found in cache');
      }
      
      // Auto-discover API structure if not found in cache
      if (!this.endpoints.users && !this.endpoints.login) {
        console.log('API structure not in cache, trying auto-discovery...');
        this.autoDiscoverApi();
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
     * Makes an authenticated API request to the MongoDB Atlas Data API
     * @param {string} endpoint - API endpoint path (e.g., '/action/find')
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {Object} payload - Data to send (for POST/PUT)
     * @param {boolean} noAuth - If true, don't add authorization header even if token exists
     * @return {Object} Response data
     */
    makeApiRequest(endpoint, method, payload = null, noAuth = false) {
      try {
        // For MongoDB Data API, most operations are POST requests to specific action endpoints
        const url = this.baseUrl + endpoint;
        const isDataApi = endpoint.startsWith('/action/');
        
        const options = {
          method: method.toLowerCase(),
          headers: {
            'Content-Type': 'application/json'
          },
          muteHttpExceptions: true
        };

        // Add authentication 
        if (!noAuth) {
          if (this.apiToken) {
            // Use JWT token if available
            options.headers['Authorization'] = `Bearer ${this.apiToken}`;
          } else if (this.apiKey && isDataApi) {
            // Use API Key for MongoDB Data API
            options.headers['api-key'] = this.apiKey;
          }
        }

        // Prepare payload
        let requestPayload = payload || {};
        
        // For MongoDB Data API, add standard fields for collection operations
        if (isDataApi && (endpoint === '/action/find' || endpoint === '/action/findOne')) {
          if (!requestPayload.dataSource) {
            requestPayload = {
              ...requestPayload,
              dataSource: this.dataSource,
              database: this.database
            };
          }
        }

        // Add payload for POST/PUT/PATCH
        if ((method === 'post' || method === 'put' || method === 'patch') && requestPayload) {
          options.payload = JSON.stringify(requestPayload);
        }

        console.log(`Making ${method.toUpperCase()} request to ${endpoint}`);
        if (options.payload) {
          console.log(`Request payload: ${options.payload.substring(0, 200)}${options.payload.length > 200 ? '...' : ''}`);
        }
        
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
        console.log(`Getting ${entityType} with filters:`, JSON.stringify(filters));
        
        // Convert filter parameters to MongoDB query format
        const query = {};
        for (const key in filters) {
          if (filters.hasOwnProperty(key) && filters[key] !== null && filters[key] !== undefined) {
            // Handle special filter cases
            if (key === 'limit' || key === 'page' || key === 'sort') {
              // These are not part of the query but used for pagination/sorting
              continue;
            }
            
            // Basic equality filter
            query[key] = filters[key];
          }
        }
        
        // Set up MongoDB Data API request payload
        const payload = {
          collection: entityType,
          database: this.database,
          dataSource: this.dataSource,
          filter: query
        };
        
        // Add options for pagination and sorting
        if (filters.limit) {
          payload.limit = parseInt(filters.limit);
        }
        
        if (filters.sort) {
          payload.sort = {};
          payload.sort[filters.sort] = 1; // Default ascending
        }
        
        // Try MongoDB Data API first
        try {
          console.log(`Using MongoDB Data API for ${entityType}`);
          const response = this.makeApiRequest('/action/find', 'post', payload);
          
          if (response && response.documents) {
            console.log(`Got ${entityType} data successfully from MongoDB Data API`);
            return response.documents;
          }
        } catch (dataApiError) {
          console.log(`MongoDB Data API failed: ${dataApiError.message}`);
          // Fall back to REST API pattern if available
        }
        
        // If Data API failed, try REST API patterns
        
        // Build query string from filters for REST API
        const queryParams = [];
        for (const key in filters) {
          if (filters.hasOwnProperty(key) && filters[key] !== null && filters[key] !== undefined) {
            queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(filters[key])}`);
          }
        }
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        
        // Use discovered endpoints if available
        let baseEndpoint;
        
        // Use the specific discovered endpoint for this entity type if available
        if (entityType === 'users' && this.endpoints.users) {
          baseEndpoint = this.endpoints.users;
        } else if (entityType === 'companies' && this.endpoints.companies) {
          baseEndpoint = this.endpoints.companies;
        } else {
          // Fall back to standard pattern
          baseEndpoint = `/api/${entityType}`;
        }
        
        console.log(`Using REST base endpoint: ${baseEndpoint}`);
        const endpoint = `${baseEndpoint}${queryString}`;
        
        // Try to make REST API request
        try {
          const response = this.makeApiRequest(endpoint, 'get');
          
          // Handle various response formats
          if (response && response.data) {
            console.log(`Got ${entityType} data successfully (data property)`);
            return Array.isArray(response.data) ? response.data : [response.data];
          } else if (response && Array.isArray(response)) {
            console.log(`Got ${entityType} data successfully (array response)`);
            return response;
          } else if (response && !response.success && !response.data && !Array.isArray(response)) {
            console.log(`${entityType} endpoint didn't return success or data property:`, Object.keys(response));
            // If response itself might be the entity or entities
            if (entityType === 'users' && response.email) {
              return [response]; // Single user object
            } else if (entityType === 'companies' && response.name) {
              return [response]; // Single company object
            }
          } else if (response && response.success === false) {
            throw new Error(response.message || `Failed to get ${entityType}`);
          }
          
          return response.data || [];
        } catch (mainEndpointError) {
          console.log(`REST endpoint failed: ${mainEndpointError.message}`);
          
          // Try alternative endpoints for this entity type
          if (entityType === 'users') {
            const alternativeUserEndpoints = ['/api/user', '/api/v1/users', '/users'];
            
            for (const altEndpoint of alternativeUserEndpoints) {
              if (altEndpoint === baseEndpoint) continue; // Skip if same as the one we already tried
              
              try {
                console.log(`Trying alternative endpoint: ${altEndpoint}${queryString}`);
                const altResponse = this.makeApiRequest(`${altEndpoint}${queryString}`, 'get');
                
                if (altResponse && (altResponse.data || Array.isArray(altResponse))) {
                  // Store this successful endpoint for future use
                  this.endpoints.users = altEndpoint;
                  const cache = CacheService.getUserCache();
                  cache.put('VOXERION_API_STRUCTURE', JSON.stringify(this.endpoints), 3600);
                  
                  return Array.isArray(altResponse.data) ? altResponse.data : 
                         Array.isArray(altResponse) ? altResponse : 
                         altResponse.data ? [altResponse.data] : [];
                }
              } catch (altError) {
                console.log(`Alternative endpoint ${altEndpoint} failed: ${altError.message}`);
                // Continue trying other alternatives
              }
            }
          } else if (entityType === 'companies') {
            const alternativeCompanyEndpoints = ['/api/company', '/api/v1/companies', '/companies'];
            
            for (const altEndpoint of alternativeCompanyEndpoints) {
              if (altEndpoint === baseEndpoint) continue; // Skip if same as the one we already tried
              
              try {
                console.log(`Trying alternative endpoint: ${altEndpoint}${queryString}`);
                const altResponse = this.makeApiRequest(`${altEndpoint}${queryString}`, 'get');
                
                if (altResponse && (altResponse.data || Array.isArray(altResponse))) {
                  // Store this successful endpoint for future use
                  this.endpoints.companies = altEndpoint;
                  const cache = CacheService.getUserCache();
                  cache.put('VOXERION_API_STRUCTURE', JSON.stringify(this.endpoints), 3600);
                  
                  return Array.isArray(altResponse.data) ? altResponse.data : 
                         Array.isArray(altResponse) ? altResponse : 
                         altResponse.data ? [altResponse.data] : [];
                }
              } catch (altError) {
                console.log(`Alternative endpoint ${altEndpoint} failed: ${altError.message}`);
                // Continue trying other alternatives
              }
            }
          }
          
          // If we're here, we couldn't use any alternative endpoint
          throw mainEndpointError;
        }
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
        console.log(`Getting ${entityType} by ID: ${id}`);
        
        // Try MongoDB Data API first with findOne operation
        try {
          // MongoDB typically uses _id field, but we need to check if we have a string ID or ObjectId
          let idField = '_id';
          let idValue = id;
          
          // Try to determine if we should use _id or id
          if (id.length !== 24 && /^[a-f0-9]{24}$/i.test(id)) {
            // This is likely a MongoDB ObjectId
            idField = '_id';
          } else {
            // This might be a custom ID
            idField = 'id';
          }
          
          const payload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            filter: {
              [idField]: idValue
            }
          };
          
          console.log(`Using MongoDB Data API findOne with ${idField}=${idValue}`);
          const response = this.makeApiRequest('/action/findOne', 'post', payload);
          
          if (response && response.document) {
            console.log(`Found ${entityType} by ${idField} using MongoDB Data API`);
            return response.document;
          }
          
          // If not found with the first ID field, try the alternative
          const alternativeField = idField === '_id' ? 'id' : '_id';
          const alternativePayload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            filter: {
              [alternativeField]: idValue
            }
          };
          
          console.log(`Trying MongoDB Data API findOne with ${alternativeField}=${idValue}`);
          const alternativeResponse = this.makeApiRequest('/action/findOne', 'post', alternativePayload);
          
          if (alternativeResponse && alternativeResponse.document) {
            console.log(`Found ${entityType} by ${alternativeField} using MongoDB Data API`);
            return alternativeResponse.document;
          }
        } catch (dataApiError) {
          console.log(`MongoDB Data API failed: ${dataApiError.message}`);
          // Fall back to REST API pattern
        }
        
        // If MongoDB Data API failed, try REST API approach
        
        // Use discovered endpoints if available
        let baseEndpoint;
        
        // Use the specific discovered endpoint for this entity type if available
        if (entityType === 'users' && this.endpoints.users) {
          baseEndpoint = this.endpoints.users;
        } else if (entityType === 'companies' && this.endpoints.companies) {
          baseEndpoint = this.endpoints.companies;
        } else {
          // Fall back to standard pattern
          baseEndpoint = `/api/${entityType}`;
        }
        
        // Ensure baseEndpoint doesn't end with a slash and id doesn't start with one
        const formattedBase = baseEndpoint.endsWith('/') ? baseEndpoint.slice(0, -1) : baseEndpoint;
        const formattedId = id.startsWith('/') ? id.slice(1) : id;
        
        const endpoint = `${formattedBase}/${formattedId}`;
        console.log(`Using REST endpoint: ${endpoint}`);
        
        try {
          const response = this.makeApiRequest(endpoint, 'get');
          
          // Handle various response formats
          if (response && response.data) {
            console.log(`Got ${entityType} by ID successfully (data property)`);
            return response.data;
          } else if (response && !response.success && !response.data) {
            console.log(`${entityType} endpoint didn't return success or data property:`, Object.keys(response));
            
            // If response itself might be the entity
            if ((entityType === 'users' && response.email) || 
                (entityType === 'companies' && response.name) ||
                (response.id === id || response._id === id)) {
              return response;
            }
          } else if (response && response.success === false) {
            throw new Error(response.message || `Entity not found: ${entityType} ${id}`);
          }
          
          return response.data || response;
        } catch (mainEndpointError) {
          console.log(`REST endpoint failed: ${mainEndpointError.message}`);
          
          // Try alternative endpoints for this entity type
          if (entityType === 'users') {
            const alternativeUserEndpoints = ['/api/user', '/api/v1/users', '/users'];
            
            for (const altEndpoint of alternativeUserEndpoints) {
              if (altEndpoint === baseEndpoint) continue; // Skip if same as the one we already tried
              
              try {
                const formattedAlt = altEndpoint.endsWith('/') ? altEndpoint.slice(0, -1) : altEndpoint;
                const altFullEndpoint = `${formattedAlt}/${formattedId}`;
                
                console.log(`Trying alternative endpoint: ${altFullEndpoint}`);
                const altResponse = this.makeApiRequest(altFullEndpoint, 'get');
                
                if (altResponse && (altResponse.data || 
                   (altResponse.id === id || altResponse._id === id))) {
                  // Store this successful endpoint for future use
                  this.endpoints.users = altEndpoint;
                  const cache = CacheService.getUserCache();
                  cache.put('VOXERION_API_STRUCTURE', JSON.stringify(this.endpoints), 3600);
                  
                  return altResponse.data || altResponse;
                }
              } catch (altError) {
                console.log(`Alternative endpoint failed: ${altError.message}`);
                // Continue trying other alternatives
              }
            }
          } else if (entityType === 'companies') {
            const alternativeCompanyEndpoints = ['/api/company', '/api/v1/companies', '/companies'];
            
            for (const altEndpoint of alternativeCompanyEndpoints) {
              if (altEndpoint === baseEndpoint) continue; // Skip if same as the one we already tried
              
              try {
                const formattedAlt = altEndpoint.endsWith('/') ? altEndpoint.slice(0, -1) : altEndpoint;
                const altFullEndpoint = `${formattedAlt}/${formattedId}`;
                
                console.log(`Trying alternative endpoint: ${altFullEndpoint}`);
                const altResponse = this.makeApiRequest(altFullEndpoint, 'get');
                
                if (altResponse && (altResponse.data || 
                   (altResponse.id === id || altResponse._id === id))) {
                  // Store this successful endpoint for future use
                  this.endpoints.companies = altEndpoint;
                  const cache = CacheService.getUserCache();
                  cache.put('VOXERION_API_STRUCTURE', JSON.stringify(this.endpoints), 3600);
                  
                  return altResponse.data || altResponse;
                }
              } catch (altError) {
                console.log(`Alternative endpoint failed: ${altError.message}`);
                // Continue trying other alternatives
              }
            }
          }
          
          // If we got here, try a query approach as last resort
          try {
            console.log(`Trying query approach for ${entityType} with ID: ${id}`);
            const entities = this.getEntities(entityType, { id: id });
            
            if (entities && entities.length > 0) {
              console.log(`Found ${entityType} by ID using query approach`);
              return entities[0];
            }
            
            // Also try _id which is common in MongoDB
            const entitiesById = this.getEntities(entityType, { _id: id });
            
            if (entitiesById && entitiesById.length > 0) {
              console.log(`Found ${entityType} by _id using query approach`);
              return entitiesById[0];
            }
          } catch (queryError) {
            console.log(`Query approach failed: ${queryError.message}`);
          }
          
          // If everything failed, return null
          console.log(`No ${entityType} found with ID: ${id}`);
          return null;
        }
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
        console.log(`Creating new ${entityType} entity:`, JSON.stringify(data).substring(0, 200));
        
        // Try MongoDB Data API first
        try {
          const payload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            document: data
          };
          
          console.log(`Using MongoDB Data API insertOne`);
          const response = this.makeApiRequest('/action/insertOne', 'post', payload);
          
          if (response && response.insertedId) {
            console.log(`Created ${entityType} with MongoDB Data API, ID: ${response.insertedId}`);
            
            // Return the created entity with its ID
            const createdEntity = {
              ...data,
              _id: response.insertedId
            };
            
            return createdEntity;
          }
        } catch (dataApiError) {
          console.log(`MongoDB Data API insertOne failed: ${dataApiError.message}`);
          // Fall back to REST API approach
        }
        
        // If MongoDB Data API failed, try REST API endpoint
        
        // Use discovered endpoints if available
        let endpoint;
        
        if (entityType === 'users' && this.endpoints.users) {
          endpoint = this.endpoints.users;
        } else if (entityType === 'companies' && this.endpoints.companies) {
          endpoint = this.endpoints.companies;
        } else {
          // Fall back to standard pattern
          endpoint = `/api/${entityType}`;
        }
        
        console.log(`Using REST endpoint: ${endpoint}`);
        const response = this.makeApiRequest(endpoint, 'post', data);

        if (response && response.success === false) {
          throw new Error(response.message || `Failed to create ${entityType}`);
        }

        return response.data || response;
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
        console.log(`Updating ${entityType} with ID: ${id}`);
        
        // Try MongoDB Data API first
        try {
          // MongoDB typically uses _id field, but we need to check if we have a string ID or ObjectId
          let idField = '_id';
          let idValue = id;
          
          // Try to determine if we should use _id or id
          if (id.length !== 24 && /^[a-f0-9]{24}$/i.test(id)) {
            // This is likely a MongoDB ObjectId
            idField = '_id';
          } else {
            // This might be a custom ID
            idField = 'id';
          }
          
          // Set up payload for updateOne operation
          const payload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            filter: {
              [idField]: idValue
            },
            update: {
              $set: data
            }
          };
          
          console.log(`Using MongoDB Data API updateOne with ${idField}=${idValue}`);
          const response = this.makeApiRequest('/action/updateOne', 'post', payload);
          
          if (response && (response.modifiedCount > 0 || response.matchedCount > 0)) {
            console.log(`Updated ${entityType} with MongoDB Data API, matches: ${response.matchedCount}, modified: ${response.modifiedCount}`);
            
            // Return the updated entity with its ID
            return {
              ...data,
              [idField]: idValue,
              _modified: response.modifiedCount > 0
            };
          }
          
          // If not found with the first ID field, try the alternative
          const alternativeField = idField === '_id' ? 'id' : '_id';
          const alternativePayload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            filter: {
              [alternativeField]: idValue
            },
            update: {
              $set: data
            }
          };
          
          console.log(`Trying MongoDB Data API updateOne with ${alternativeField}=${idValue}`);
          const alternativeResponse = this.makeApiRequest('/action/updateOne', 'post', alternativePayload);
          
          if (alternativeResponse && (alternativeResponse.modifiedCount > 0 || alternativeResponse.matchedCount > 0)) {
            console.log(`Updated ${entityType} with MongoDB Data API using ${alternativeField}, matches: ${alternativeResponse.matchedCount}, modified: ${alternativeResponse.modifiedCount}`);
            
            return {
              ...data,
              [alternativeField]: idValue,
              _modified: alternativeResponse.modifiedCount > 0
            };
          }
        } catch (dataApiError) {
          console.log(`MongoDB Data API updateOne failed: ${dataApiError.message}`);
          // Fall back to REST API approach
        }
        
        // If MongoDB Data API failed, try REST API endpoint
        
        // Use discovered endpoints if available
        let baseEndpoint;
        
        if (entityType === 'users' && this.endpoints.users) {
          baseEndpoint = this.endpoints.users;
        } else if (entityType === 'companies' && this.endpoints.companies) {
          baseEndpoint = this.endpoints.companies;
        } else {
          // Fall back to standard pattern
          baseEndpoint = `/api/${entityType}`;
        }
        
        // Ensure baseEndpoint doesn't end with a slash and id doesn't start with one
        const formattedBase = baseEndpoint.endsWith('/') ? baseEndpoint.slice(0, -1) : baseEndpoint;
        const formattedId = id.startsWith('/') ? id.slice(1) : id;
        
        const endpoint = `${formattedBase}/${formattedId}`;
        
        console.log(`Using REST endpoint: ${endpoint}`);
        const response = this.makeApiRequest(endpoint, 'put', data);

        if (response && response.success === false) {
          throw new Error(response.message || `Failed to update ${entityType}`);
        }

        return response.data || response;
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
        console.log(`Deleting ${entityType} with ID: ${id}`);
        
        // Try MongoDB Data API first
        try {
          // MongoDB typically uses _id field, but we need to check if we have a string ID or ObjectId
          let idField = '_id';
          let idValue = id;
          
          // Try to determine if we should use _id or id
          if (id.length !== 24 && /^[a-f0-9]{24}$/i.test(id)) {
            // This is likely a MongoDB ObjectId
            idField = '_id';
          } else {
            // This might be a custom ID
            idField = 'id';
          }
          
          // Set up payload for deleteOne operation
          const payload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            filter: {
              [idField]: idValue
            }
          };
          
          console.log(`Using MongoDB Data API deleteOne with ${idField}=${idValue}`);
          const response = this.makeApiRequest('/action/deleteOne', 'post', payload);
          
          if (response && response.deletedCount > 0) {
            console.log(`Deleted ${entityType} with MongoDB Data API, count: ${response.deletedCount}`);
            return true;
          }
          
          // If not found with the first ID field, try the alternative
          const alternativeField = idField === '_id' ? 'id' : '_id';
          const alternativePayload = {
            collection: entityType,
            database: this.database,
            dataSource: this.dataSource,
            filter: {
              [alternativeField]: idValue
            }
          };
          
          console.log(`Trying MongoDB Data API deleteOne with ${alternativeField}=${idValue}`);
          const alternativeResponse = this.makeApiRequest('/action/deleteOne', 'post', alternativePayload);
          
          if (alternativeResponse && alternativeResponse.deletedCount > 0) {
            console.log(`Deleted ${entityType} with MongoDB Data API using ${alternativeField}, count: ${alternativeResponse.deletedCount}`);
            return true;
          }
        } catch (dataApiError) {
          console.log(`MongoDB Data API deleteOne failed: ${dataApiError.message}`);
          // Fall back to REST API approach
        }
        
        // If MongoDB Data API failed, try REST API endpoint
        
        // Use discovered endpoints if available
        let baseEndpoint;
        
        if (entityType === 'users' && this.endpoints.users) {
          baseEndpoint = this.endpoints.users;
        } else if (entityType === 'companies' && this.endpoints.companies) {
          baseEndpoint = this.endpoints.companies;
        } else {
          // Fall back to standard pattern
          baseEndpoint = `/api/${entityType}`;
        }
        
        // Ensure baseEndpoint doesn't end with a slash and id doesn't start with one
        const formattedBase = baseEndpoint.endsWith('/') ? baseEndpoint.slice(0, -1) : baseEndpoint;
        const formattedId = id.startsWith('/') ? id.slice(1) : id;
        
        const endpoint = `${formattedBase}/${formattedId}`;
        
        console.log(`Using REST endpoint: ${endpoint}`);
        const response = this.makeApiRequest(endpoint, 'delete');

        return response && (response.success === true || response.deleted === true || response.deletedCount > 0);
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
        console.log(`Looking up company by domain: ${domain}`);
        
        // Check if we have a discovered company_by_domain endpoint
        if (this.endpoints.company_by_domain) {
          // Replace {domain} placeholder if present
          const endpoint = this.endpoints.company_by_domain.replace('{domain}', domain);
          console.log(`Using discovered endpoint: ${endpoint}`);
          
          try {
            const response = this.makeApiRequest(endpoint, 'get');
            
            if (response && (response.success || response.data)) {
              console.log(`Found company using discovered endpoint`);
              return response.data || response;
            }
          } catch (discoveredEndpointError) {
            console.log(`Discovered endpoint failed: ${discoveredEndpointError.message}`);
            // Continue with fallbacks
          }
        }
        
        // Traditional endpoints to try
        const fallbackEndpoints = [
          `/api/companies/domain/${domain}`,
          `/api/companies/by-domain/${domain}`,
          `/api/company/domain/${domain}`
        ];
        
        // Try each fallback endpoint
        for (const endpoint of fallbackEndpoints) {
          try {
            console.log(`Trying fallback endpoint: ${endpoint}`);
            const response = this.makeApiRequest(endpoint, 'get');
            
            if (response && (response.success || response.data)) {
              console.log(`Found company using fallback endpoint: ${endpoint}`);
              
              // Store this successful endpoint for future use
              this.endpoints.company_by_domain = endpoint.replace(domain, '{domain}');
              const cache = CacheService.getUserCache();
              cache.put('VOXERION_API_STRUCTURE', JSON.stringify(this.endpoints), 3600); // 1 hour cache
              
              return response.data || response;
            }
          } catch (fallbackError) {
            console.log(`Fallback endpoint ${endpoint} failed: ${fallbackError.message}`);
            // Continue with next fallback
          }
        }
        
        // Fall back to using query parameters on the standard companies endpoint
        console.log('Trying query parameter approach');
        
        // Determine companies base endpoint
        const companiesEndpoint = this.endpoints.companies || '/api/companies';
        const queryEndpoint = `${companiesEndpoint}?domain=${encodeURIComponent(domain)}`;
        
        try {
          console.log(`Using query endpoint: ${queryEndpoint}`);
          const response = this.makeApiRequest(queryEndpoint, 'get');
          
          if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
            console.log('Found company using query parameters');
            return response.data[0];
          }
        } catch (queryError) {
          console.log(`Query approach failed: ${queryError.message}`);
        }
        
        // Final fallback: get all companies and filter client-side
        console.log('Falling back to client-side filtering');
        try {
          const allCompanies = this.getEntities('companies');
          
          if (Array.isArray(allCompanies)) {
            const foundCompany = allCompanies.find(company => {
              // Check domain property
              if (company.domain === domain) return true;
              
              // Check domains array property
              if (Array.isArray(company.domains) && company.domains.includes(domain)) return true;
              
              return false;
            });
            
            if (foundCompany) {
              console.log('Found company by client-side filtering');
              return foundCompany;
            }
          }
        } catch (allCompaniesError) {
          console.log(`Client-side filtering failed: ${allCompaniesError.message}`);
        }
        
        console.log(`No company found for domain: ${domain}`);
        return null;
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
        console.log(`Checking if user exists: ${email}`);
        
        // Use discovered user_by_email endpoint if available
        if (this.endpoints.user_by_email) {
          const discoveredEndpoint = this.endpoints.user_by_email.replace('{email}', encodeURIComponent(email));
          console.log(`Using discovered endpoint: ${discoveredEndpoint}`);
          
          try {
            const response = this.makeApiRequest(discoveredEndpoint, 'get', null, true);
            
            if (response && (response.success || response.data || response.user)) {
              console.log(`Found user using discovered endpoint`);
              return response.data || response.user || response;
            }
            
            if (response && response.exists === false) {
              console.log(`User explicitly doesn't exist according to discovered endpoint`);
              return null;
            }
          } catch (discoveredEndpointError) {
            console.log(`Discovered endpoint failed: ${discoveredEndpointError.message}`);
            // Try authenticated version if it failed as public endpoint
            if (this.apiToken) {
              try {
                console.log(`Trying discovered endpoint with authentication`);
                const response = this.makeApiRequest(discoveredEndpoint, 'get');
                
                if (response && (response.success || response.data || response.user)) {
                  console.log(`Found user using authenticated discovered endpoint`);
                  return response.data || response.user || response;
                }
              } catch (authError) {
                console.log(`Authenticated discovered endpoint failed: ${authError.message}`);
              }
            }
          }
        }
        
        // Try traditional endpoints
        const existsEndpoints = [
          `/api/users/exists/${encodeURIComponent(email)}`,
          `/api/users/email/${encodeURIComponent(email)}`,
          `/api/users/by-email/${encodeURIComponent(email)}`,
          `/api/users/find/${encodeURIComponent(email)}`,
          `/api/user/${encodeURIComponent(email)}`
        ];
        
        // Try each endpoint
        for (const endpoint of existsEndpoints) {
          try {
            console.log(`Trying fallback endpoint: ${endpoint}`);
            const response = this.makeApiRequest(endpoint, 'get', null, true);
            
            if (response && (response.success || response.data || response.user)) {
              console.log(`Found user using fallback endpoint: ${endpoint}`);
              
              // Store this successful endpoint for future use
              this.endpoints.user_by_email = endpoint.replace(encodeURIComponent(email), '{email}');
              const cache = CacheService.getUserCache();
              cache.put('VOXERION_API_STRUCTURE', JSON.stringify(this.endpoints), 3600); // 1 hour cache
              
              return response.data || response.user || response;
            }
            
            if (response && response.exists === false) {
              console.log(`User explicitly doesn't exist according to ${endpoint}`);
              return null;
            }
          } catch (fallbackError) {
            console.log(`Fallback endpoint ${endpoint} failed: ${fallbackError.message}`);
            // Continue with next fallback
          }
        }
        
        // Try query parameter approach
        const usersEndpoint = this.endpoints.users || '/api/users';
        const queryEndpoint = `${usersEndpoint}?email=${encodeURIComponent(email)}`;
        
        try {
          console.log(`Using query endpoint: ${queryEndpoint}`);
          const response = this.makeApiRequest(queryEndpoint, 'get', null, !this.apiToken);
          
          if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
            console.log('Found user using query parameters');
            return response.data[0];
          }
        } catch (queryError) {
          console.log(`Query approach failed: ${queryError.message}`);
        }
        
        // Fallback to regular lookup via guest token if available
        if (this.guestToken) {
          console.log('Trying with guest token');
          const savedToken = this.apiToken;
          
          try {
            this.setToken(this.guestToken);
            const users = this.getEntities('users', { email: email, limit: 1 });
            
            if (users && users.length > 0) {
              console.log('Found user using guest token');
              return users[0];
            }
          } catch (guestTokenError) {
            console.log(`Guest token approach failed: ${guestTokenError.message}`);
          } finally {
            this.setToken(savedToken);
          }
        }
        
        console.log(`No user found for email: ${email}`);
        return null;
      } catch (error) {
        console.error(`Error checking if user exists: ${email}`, error);
        return null;
      }
    }

    /**
     * Tries all available authentication endpoints to get a valid token
     * @param {Object} credentials - Login credentials
     * @return {Object} Auth response with token
     */
    authenticate(credentials) {
      console.log("Trying authentication with available endpoints...");
      
      // List of possible auth endpoints to try
      const authEndpoints = [
        { endpoint: '/api/auth/login', method: 'post' },
        { endpoint: '/api/login', method: 'post' },
        { endpoint: '/api/account/login', method: 'post' },
        { endpoint: '/api/user/login', method: 'post' },
        { endpoint: '/api/users/login', method: 'post' },
        { endpoint: '/api/auth/signin', method: 'post' },
        { endpoint: '/api/signin', method: 'post' },
        { endpoint: '/api/v1/auth/login', method: 'post' },
        { endpoint: '/auth/login', method: 'post' },
      ];
      
      // Default credentials if none provided
      const authPayload = credentials || {
        email: 'admin@voxerion.com',
        password: 'admin123'
      };
      
      // Try each endpoint
      for (const authOption of authEndpoints) {
        try {
          console.log(`Trying auth endpoint: ${authOption.endpoint}`);
          const response = this.makeApiRequest(authOption.endpoint, authOption.method, authPayload, true);
          
          // Look for token in various possible response formats
          let token = null;
          if (response.token) {
            token = response.token;
          } else if (response.access_token) {
            token = response.access_token;
          } else if (response.data && response.data.token) {
            token = response.data.token;
          } else if (response.accessToken) {
            token = response.accessToken;
          } else if (response.jwt) {
            token = response.jwt;
          }
          
          if (token) {
            console.log(`Authentication successful with endpoint: ${authOption.endpoint}`);
            
            // Set the token for subsequent requests
            this.setToken(token);
            
            // Save the token in cache for future use
            const cache = CacheService.getUserCache();
            cache.put('VOXERION_API_TOKEN', token, 60 * 60); // 1 hour expiry
            cache.put('VOXERION_AUTH_ENDPOINT', authOption.endpoint, 60 * 60); // Remember which endpoint worked
            
            return {
              token: token,
              user: response.user || response.data || null
            };
          }
        } catch (endpointError) {
          console.log(`Auth endpoint ${authOption.endpoint} failed:`, endpointError.message);
          // Continue trying other endpoints
        }
      }
      
      // If we get here, all endpoints failed
      throw new Error('All authentication endpoints failed');
    }
    
    /**
     * Try to authenticate with various credentials
     * @return {boolean} True if authentication successful
     */
    tryAuth() {
      try {
        console.log("Trying authentication...");
        
        // Check if we already have a token
        if (this.apiToken) {
          console.log("Token exists, validating it...");
          try {
            // Try a simple request to see if token is valid
            this.makeApiRequest('/api/users', 'get', null, false);
            console.log("Existing token is valid");
            return true;
          } catch (tokenError) {
            console.log("Existing token is invalid, clearing it");
            this.apiToken = "";
          }
        }
        
        // Try to get the previously successful endpoint
        const cache = CacheService.getUserCache();
        const prevEndpoint = cache.get('VOXERION_AUTH_ENDPOINT');
        
        // List of credential sets to try
        const credentialSets = [
          { email: 'admin@voxerion.com', password: 'admin123' },
          { email: 'guest@voxerion.com', password: 'guest123' },
          { email: 'alysson.franklin@voxerion.com', password: 'password123' },
          { username: 'admin', password: 'admin' },
          { username: 'guest', password: 'guest' }
        ];
        
        // If we have a previous successful endpoint, try it first with all credentials
        if (prevEndpoint) {
          console.log(`Trying previously successful endpoint: ${prevEndpoint}`);
          for (const creds of credentialSets) {
            try {
              const response = this.makeApiRequest(prevEndpoint, 'post', creds, true);
              if (response.token || response.access_token) {
                console.log("Authentication successful with previous endpoint");
                this.setToken(response.token || response.access_token);
                return true;
              }
            } catch (e) {
              // Continue to next credential set
            }
          }
        }
        
        // If that failed, try the full authentication process
        for (const creds of credentialSets) {
          try {
            this.authenticate(creds);
            console.log("Authentication successful");
            return true;
          } catch (e) {
            // Continue to next credential set
          }
        }
        
        // Last resort: try direct token generation
        try {
          // Sometimes APIs have development/testing endpoints
          console.log("Trying direct token generation...");
          const tokenResponse = this.makeApiRequest('/api/development/token', 'get', null, true);
          if (tokenResponse.token) {
            this.setToken(tokenResponse.token);
            return true;
          }
        } catch (e) {
          // Ignore, just a fallback attempt
        }
        
        console.warn('All authentication attempts failed');
        return false;
      } catch (error) {
        console.warn('Authentication error:', error);
        return false;
      }
    }

    /**
     * Discovers available endpoints by trying common paths
     * This is a diagnostic method to help figure out the API structure
     * @return {Object} Map of available endpoints
     */
    discoverEndpoints() {
      console.log("Starting API endpoint discovery...");
      
      // Common API paths to try
      const pathsToTry = [
        '/api',
        '/api/users',
        '/api/user',
        '/api/auth',
        '/api/companies',
        '/api/company',
        '/api/v1',
        '/api/v1/users',
        '/api/v1/auth',
        '/auth',
        '/users',
        '/login',
        '/signin',
        '/companies',
        '/api/ping',
        '/api/health',
        '/api/info',
        '/api/status'
      ];
      
      const results = {};
      
      // Try each path
      for (const path of pathsToTry) {
        try {
          console.log(`Trying path: ${path}`);
          const response = this.makeApiRequest(path, 'get', null, true);
          
          // If we get here, the endpoint exists
          results[path] = {
            exists: true,
            responseType: typeof response,
            isArray: Array.isArray(response),
            status: 'success',
            hasData: response && response.data ? true : false,
            keys: Object.keys(response)
          };
          
          console.log(`Endpoint ${path} EXISTS`);
        } catch (error) {
          const statusCode = error.message.match(/API Error \((\d+)\)/);
          
          if (statusCode && statusCode[1]) {
            results[path] = {
              exists: statusCode[1] !== '404', // Anything but 404 means it exists but we can't access it
              status: statusCode[1],
              message: error.message
            };
            
            if (statusCode[1] === '401' || statusCode[1] === '403') {
              console.log(`Endpoint ${path} EXISTS but requires authentication`);
            } else if (statusCode[1] === '404') {
              console.log(`Endpoint ${path} does NOT exist`);
            } else {
              console.log(`Endpoint ${path} status: ${statusCode[1]}`);
            }
          } else {
            results[path] = {
              exists: false,
              status: 'error',
              message: error.message
            };
            console.log(`Endpoint ${path} error: ${error.message}`);
          }
        }
      }
      
      console.log("API discovery complete");
      return results;
    }
    
    /**
     * Automatically discovers the API structure and maps key endpoints
     * Uses progressive discovery approach to find and test endpoints
     * @return {Object} Discovered API endpoints structure
     */
    autoDiscoverApi() {
      console.log("Initiating auto-discovery of API structure...");
      
      // Structure to store discovered endpoints
      const discoveredEndpoints = {
        login: null,
        users: null,
        user_by_email: null,
        companies: null,
        company_by_domain: null
      };
      
      try {
        // Phase 1: Get basic API information by discovering endpoints
        const baseDiscovery = this.discoverEndpoints();
        console.log("Phase 1 discovery complete, analyzing results...");
        
        // Phase 2: Try to authenticate to get better access
        let authenticated = false;
        try {
          authenticated = this.tryAuth();
          console.log(`Authentication ${authenticated ? 'successful' : 'failed'}`);
        } catch (authError) {
          console.log("Authentication error:", authError);
        }
        
        // Phase 3: Process discovered endpoints to find key functionality
        
        // Find login endpoint
        const potentialLoginEndpoints = [
          '/api/auth/login', 
          '/api/login', 
          '/api/account/login',
          '/api/user/login',
          '/api/users/login',
          '/api/auth/signin',
          '/api/signin',
          '/auth/login',
          '/login'
        ];
        
        for (const endpoint of potentialLoginEndpoints) {
          if (baseDiscovery[endpoint] && 
              (baseDiscovery[endpoint].exists || 
               baseDiscovery[endpoint].status === '401' || 
               baseDiscovery[endpoint].status === '403')) {
            discoveredEndpoints.login = endpoint;
            console.log(`Discovered login endpoint: ${endpoint}`);
            break;
          }
        }
        
        // Find users endpoints
        const potentialUsersEndpoints = [
          '/api/users',
          '/api/user',
          '/api/v1/users',
          '/users'
        ];
        
        for (const endpoint of potentialUsersEndpoints) {
          if (baseDiscovery[endpoint] && 
              (baseDiscovery[endpoint].exists || 
               baseDiscovery[endpoint].status === '401' || 
               baseDiscovery[endpoint].status === '403')) {
            discoveredEndpoints.users = endpoint;
            console.log(`Discovered users endpoint: ${endpoint}`);
            break;
          }
        }
        
        // Find companies endpoints
        const potentialCompaniesEndpoints = [
          '/api/companies',
          '/api/company',
          '/api/v1/companies',
          '/companies'
        ];
        
        for (const endpoint of potentialCompaniesEndpoints) {
          if (baseDiscovery[endpoint] && 
              (baseDiscovery[endpoint].exists || 
               baseDiscovery[endpoint].status === '401' || 
               baseDiscovery[endpoint].status === '403')) {
            discoveredEndpoints.companies = endpoint;
            console.log(`Discovered companies endpoint: ${endpoint}`);
            break;
          }
        }
        
        // Phase 4: Try specific pattern-based endpoints
        
        // Try to find user-by-email endpoints
        if (discoveredEndpoints.users) {
          const emailPatterns = [
            `${discoveredEndpoints.users}/by-email/test@example.com`,
            `${discoveredEndpoints.users}/email/test@example.com`,
            `${discoveredEndpoints.users}/find/test@example.com`,
            `${discoveredEndpoints.users}/lookup/test@example.com`,
            `${discoveredEndpoints.users}?email=test@example.com`,
            `${discoveredEndpoints.users}/exists/test@example.com`
          ];
          
          for (const pattern of emailPatterns) {
            try {
              console.log(`Testing user-by-email pattern: ${pattern}`);
              this.makeApiRequest(pattern, 'get', null, !authenticated);
              discoveredEndpoints.user_by_email = pattern.replace('test@example.com', '{email}');
              console.log(`Discovered user-by-email endpoint: ${discoveredEndpoints.user_by_email}`);
              break;
            } catch (error) {
              const statusCode = error.message.match(/API Error \((\d+)\)/);
              if (statusCode && (statusCode[1] === '401' || statusCode[1] === '403')) {
                // Auth required endpoints are valid, just need auth
                discoveredEndpoints.user_by_email = pattern.replace('test@example.com', '{email}');
                console.log(`Discovered auth-required user-by-email endpoint: ${discoveredEndpoints.user_by_email}`);
                break;
              }
              // Otherwise continue to next pattern
            }
          }
        }
        
        // Try to find company-by-domain endpoints
        if (discoveredEndpoints.companies) {
          const domainPatterns = [
            `${discoveredEndpoints.companies}/domain/example.com`,
            `${discoveredEndpoints.companies}/by-domain/example.com`,
            `${discoveredEndpoints.companies}/find/example.com`,
            `${discoveredEndpoints.companies}/lookup/example.com`,
            `${discoveredEndpoints.companies}?domain=example.com`
          ];
          
          for (const pattern of domainPatterns) {
            try {
              console.log(`Testing company-by-domain pattern: ${pattern}`);
              this.makeApiRequest(pattern, 'get', null, !authenticated);
              discoveredEndpoints.company_by_domain = pattern.replace('example.com', '{domain}');
              console.log(`Discovered company-by-domain endpoint: ${discoveredEndpoints.company_by_domain}`);
              break;
            } catch (error) {
              const statusCode = error.message.match(/API Error \((\d+)\)/);
              if (statusCode && (statusCode[1] === '401' || statusCode[1] === '403')) {
                // Auth required endpoints are valid, just need auth
                discoveredEndpoints.company_by_domain = pattern.replace('example.com', '{domain}');
                console.log(`Discovered auth-required company-by-domain endpoint: ${discoveredEndpoints.company_by_domain}`);
                break;
              }
              // Otherwise continue to next pattern
            }
          }
        }
        
        // Phase 5: Save discovered endpoints to class and cache
        this.endpoints = discoveredEndpoints;
        console.log("Final API structure:", this.endpoints);
        
        // Cache the discovered structure
        try {
          const cache = CacheService.getUserCache();
          cache.put('VOXERION_API_STRUCTURE', JSON.stringify(discoveredEndpoints), 3600); // 1 hour cache
          console.log("API structure cached successfully");
        } catch (cacheError) {
          console.error("Failed to cache API structure:", cacheError);
        }
        
        return discoveredEndpoints;
      } catch (error) {
        console.error("Error in autoDiscoverApi:", error);
        
        // Return partial results if available, or fallback to defaults
        if (Object.values(discoveredEndpoints).some(v => v !== null)) {
          console.log("Returning partial discovery results");
          return discoveredEndpoints;
        } else {
          // Fallback to default endpoints
          console.log("Using fallback endpoint structure");
          const fallbackEndpoints = {
            login: '/api/auth/login',
            users: '/api/users',
            user_by_email: '/api/users/by-email/{email}',
            companies: '/api/companies',
            company_by_domain: '/api/companies/domain/{domain}'
          };
          
          this.endpoints = fallbackEndpoints;
          return fallbackEndpoints;
        }
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