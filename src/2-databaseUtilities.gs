/**
   * calendar.gs functions
   */
  // Auth service configuration
  const AUTH_CONFIG = {
    TOKEN_CACHE_KEY: 'KANTOR_AUTH_TOKEN',
    TOKEN_EXPIRY_CACHE_KEY: 'KANTOR_TOKEN_EXPIRY',
    DB_SPREADSHEET_ID: '1BSbZyBdsV_x4sAhkrayqxHKrZKEof7Fojm6vbi4IKc4', // For backwards compatibility
    API_BASE_URL: 'https://kantor-onboarding-alysson-franklins-projects.vercel.app', // New MongoDB API base URL
    MAX_RETRIES: 7,
    RETRY_DELAY_MS: 1000,
    TOKEN_EXPIRY_MINUTES: 15,
    BRAND_COLOR: '#E62E05',
    LOGO_CACHE_KEY: 'VOXERION_LOGO_CACHE',
    LOGO_URL: 'https://drive.google.com/uc?export=view&id=1qc71zsD-u-Y1fq87PLKaqgu9pPrRG6uO',
    // Base64 encoded small SVG for immediate display while actual logo loads
    LOGO_PLACEHOLDER:
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRjZCMDI2IiByeD0iMTAiLz48dGV4dCB4PSIxMyIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyI+VjwvdGV4dD48L3N2Zz4='
  };


/**
 * Retrieves localized UI labels from a CSV file stored in Google Drive.
 * Uses UrlFetchApp to access the CSV directly instead of DriveApp.
 * 
 * @return {Object} Object containing all UI labels
 */
function getLabels() {
  try {
    // Get fallback labels first, so we can merge with any loaded labels
    const fallbackLabels = getFallbackLabels();
    const labels = Object.assign({}, fallbackLabels);
    
    try {
      // Store the file ID in Script Properties instead of hardcoding
      const fileId = PropertiesService.getScriptProperties().getProperty('LABELS_FILE_ID') || 
                    '1XjkFv91QuQysPSgF99ak99gcs8CUn1_H';
      
      // Get user's locale from calendar settings if possible
      const userLocale = getUserLocale();
      
      // Instead of using DriveApp, access the file directly via URL
      const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      const response = UrlFetchApp.fetch(url, {
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        console.warn('Error accessing CSV file, using fallback labels');
        return labels;
      }
      
      const csvContent = response.getContentText();
      const rows = Utilities.parseCsv(csvContent);
      
      if (rows.length === 0 || rows[0].length === 0) {
        console.warn('Labels file is empty or malformed, using fallback labels');
        return labels;
      }
      
      const headerRow = rows[0];
      // Try to match user locale, fallback to 'pt' if not found
      let languageIndex = headerRow.indexOf(userLocale);
      if (languageIndex === -1) {
        languageIndex = headerRow.indexOf('pt');
      }
      
      // If still not found, use the first language column after the key column
      if (languageIndex === -1 && headerRow.length > 1) {
        languageIndex = 1;
      }
      
      // Cache the labels in memory for better performance
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length > languageIndex) {
          const key = rows[i][0];
          if (key && key.trim() !== '') {
            const value = rows[i][languageIndex] || key; // Use key as fallback if translation missing
            labels[key] = value;
          }
        }
      }
    } catch (csvError) {
      console.error('Error loading CSV labels:', csvError);
      // No need to throw, we'll use the fallback labels
    }
    
    // Validate that essential labels are present
    const essentialLabels = [
      'access_required', 
      'contact_admin', 
      'contact_support', 
      'try_again',
      'get_insight'
    ];
    
    essentialLabels.forEach(key => {
      if (!labels[key]) {
        labels[key] = fallbackLabels[key] || key;
      }
    });
    
    return labels;
  } catch (error) {
    console.error('Fatal error in getLabels:', error);
    return getFallbackLabels();
  }
}

/**
 * Gets user's locale from Calendar properties or falls back to default
 * @return {string} User locale code (e.g., 'en', 'pt', 'es')
 */
function getUserLocale() {
  try {
    // Try to get locale from user properties
    const userProperties = PropertiesService.getUserProperties();
    const storedLocale = userProperties.getProperty('VOXERION_USER_LOCALE');
    
    if (storedLocale) {
      return storedLocale.substring(0, 2).toLowerCase();
    }
    
    // Alternative method - try to get from Calendar if possible
    // Note: CalendarApp doesn't actually have a getSettings method,
    // so we'll try a safer approach
    const session = Session.getActiveUserLocale();
    if (session) {
      const localeCode = session.substring(0, 2).toLowerCase();
      // Store it for future use
      userProperties.setProperty('VOXERION_USER_LOCALE', localeCode);
      return localeCode;
    }
  } catch (e) {
    console.log('Could not determine user locale:', e);
  }
  
  return 'pt'; // Default to Portuguese
}

function getFallbackLabels() {
  return {
    // Essential labels that are referenced directly in code
    welcome_title: 'Welcome to Voxerion',
    welcome_desc: 'A personal assistant that helps you to better communicate with your employees helping you to become a better leader and progress in your career.',
    welcome_start: 'Select a calendar event to start.',
    meeting_starts_in: 'This meeting starts in',
    meeting_started: 'This meeting has started',
    hours: 'hours',
    hour: 'hour',
    and: 'and',
    minutes: 'minutes',
    new_event: 'New meeting being created',
    no_title: 'No title provided',
    get_insight: 'Get Insights',
    
    // API-related messages
    apiGenIns: 'Generating insights...',
    apiGenLoa: 'Loading insights...',
    apiGenWai: 'Please wait while we analyze your meeting details...',
    apiGenMee: 'Generating meeting insights...',
    apiAnaDet: '🤔 Analyzing your meeting details...',
    apiKanWor: 'Voxerion is working...',
    apiFewSec: 'This might take a few seconds.',
    apiKanQu1: 'Can you give me insights for this meeting with',
    apiKanQu2: 'We will talk about',
    apiMeeIns: 'Meeting Insights',
    apiMeeAIi: '📊 AI-Generated Insights',
    apiBckMee: 'Back to Meeting',
    apiInsSuc: 'Insights generated successfully!',
    apiErrIns: 'Error: Unable to generate insights',
    apiCopyIns: 'Copy Insights',
    apiCopyTxt: 'The text has been added to a text field above. Press Ctrl+C (or Cmd+C) to copy it.',
    apiDone: 'Done',
    
    // Authentication/authorization-related messages
    access_required: '🔒 Access Required',
    contact_admin: 'Please contact your administrator to get access to Voxerion.',
    contact_support: 'Contact Support',
    try_again: 'Try Again',
    refresh: 'Refresh',
    logged_in_as: 'Logged in as:',
    logout: 'Logout',
    logout_success: 'Logged out successfully',
    return_to_login: 'Return to Login',
    
    // Error messages
    error: 'An error occurred',
    error_try_again: 'An error occurred. Please try again later.'
  };
}

/**
 * Cache for Assistant ID validation to avoid repeated validation requests
 */
const VALIDATED_ASSISTANTS = {};

/**
 * Gets the Voxerion logo URL with caching for better performance
 * @return {string} The URL to use for the logo
 */
function getLogoUrl() {
  try {
    // Try to get from script cache first (shared across users)
    const scriptCache = CacheService.getScriptCache();
    const cachedLogo = scriptCache.get(AUTH_CONFIG.LOGO_CACHE_KEY);
    
    if (cachedLogo) {
      console.log('Using cached logo URL');
      return cachedLogo;
    }
    
    // For now, we'll use the Drive URL directly
    // Cache the URL to avoid DNS lookups
    scriptCache.put(AUTH_CONFIG.LOGO_CACHE_KEY, AUTH_CONFIG.LOGO_URL, 21600); // 6 hours
    
    // Return the original URL
    return AUTH_CONFIG.LOGO_URL;
  } catch (error) {
    console.error('Error getting logo URL:', error);
    // Return the placeholder as fallback
    return AUTH_CONFIG.LOGO_PLACEHOLDER;
  }
}

/**
 * Optimized OpenAI API request function
 * @param {string} prompt - The prompt to send to the OpenAI Assistant
 * @param {string} assistantId - Optional assistant ID (bypasses DB lookup if provided)
 * @return {Object} Response object with content
 */
function makeOpenAIRequest(prompt, assistantId = null) {
  try {
    // Start timer for performance measurement
    const startTime = new Date().getTime();
    
    // Get API key only once - store in cache if needed in future
    const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('System configuration error: API key not found');
    }
    
    // Determine which Assistant ID to use
    let ASSISTANT_ID;
    if (assistantId) {
      ASSISTANT_ID = assistantId;
    } else {
      const userEmail = Session.getActiveUser().getEmail();
      const db = new VoxerionDatabase();
      const userAccess = db.getUserAccessDetails(userEmail, false); // Use cache for performance
      
      if (!userAccess || !userAccess.assistantId) {
        throw new Error('User not authorized or Assistant ID not found');
      }
      ASSISTANT_ID = userAccess.assistantId;
    }
    
    console.log('Starting OpenAI request with Assistant ID:', ASSISTANT_ID);
    
    // 1. Only validate Assistant ID if not already validated
    if (!VALIDATED_ASSISTANTS[ASSISTANT_ID]) {
      try {
        const validateRequest = {
          'method': 'get',
          'headers': {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          },
          'muteHttpExceptions': true
        };
        
        console.log('Validating assistant...');
        const validateResponse = UrlFetchApp.fetch(`https://api.openai.com/v1/assistants/${ASSISTANT_ID}`, validateRequest);
        
        if (validateResponse.getResponseCode() !== 200) {
          throw new Error(`Invalid Assistant ID (HTTP ${validateResponse.getResponseCode()})`);
        }
        
        const assistant = JSON.parse(validateResponse.getContentText());
        console.log('Assistant validated:', assistant.id);
        VALIDATED_ASSISTANTS[ASSISTANT_ID] = true; // Cache the validation
      } catch (error) {
        console.error('Assistant validation failed:', error);
        throw new Error(`Invalid Assistant ID: ${ASSISTANT_ID}`);
      }
    } else {
      console.log('Using cached assistant validation');
    }

    // 2. Create thread, message, and run in a more optimized way
    let thread;
    let run;
    
    // Shared headers for all API calls
    const headers = {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    };
    
    // Create thread and store ID
    try {
      console.log('Creating thread...');
      const threadResponse = UrlFetchApp.fetch('https://api.openai.com/v1/threads', {
        'method': 'post',
        'headers': headers,
        'muteHttpExceptions': true
      });
      
      if (threadResponse.getResponseCode() !== 200) {
        throw new Error(`Thread creation failed (HTTP ${threadResponse.getResponseCode()})`);
      }
      
      thread = JSON.parse(threadResponse.getContentText());
      console.log('Thread created:', thread.id);
    } catch (error) {
      console.error('Thread creation failed:', error);
      throw new Error('Failed to create conversation thread');
    }
    
    // Add message to thread
    try {
      console.log('Adding message...');
      const messageResponse = UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
        'method': 'post',
        'headers': headers,
        'payload': JSON.stringify({
          'role': 'user',
          'content': prompt
        }),
        'muteHttpExceptions': true
      });
      
      if (messageResponse.getResponseCode() !== 200) {
        throw new Error(`Message addition failed (HTTP ${messageResponse.getResponseCode()})`);
      }
      
      console.log('Message added successfully');
    } catch (error) {
      console.error('Message addition failed:', error);
      throw new Error('Failed to add message to thread');
    }
    
    // Run the assistant on the thread
    try {
      console.log('Starting assistant run...');
      const runResponse = UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
        'method': 'post',
        'headers': headers,
        'payload': JSON.stringify({
          'assistant_id': ASSISTANT_ID
        }),
        'muteHttpExceptions': true
      });
      
      if (runResponse.getResponseCode() !== 200) {
        throw new Error(`Run creation failed (HTTP ${runResponse.getResponseCode()})`);
      }
      
      run = JSON.parse(runResponse.getContentText());
      console.log('Run created:', run.id);
    } catch (error) {
      console.error('Run creation failed:', error);
      throw new Error('Failed to start assistant');
    }
    
    // 3. Poll for completion with optimized backoff strategy
    const maxAttempts = AUTH_CONFIG.MAX_RETRIES;
    let attempts = 0;
    let runStatus;
    
    // Use more efficient exponential backoff
    const getRetryDelay = (attempt) => {
      // Start with a shorter delay but scale up faster for later attempts
      return Math.min(500 * Math.pow(1.5, attempt), 5000); // Start at 500ms, cap at 5 seconds
    };
    
    console.log('Waiting for completion...');
    do {
      try {
        // Exponential backoff with first delay being very short
        const delay = getRetryDelay(attempts);
        console.log(`Waiting ${delay}ms before checking status (attempt ${attempts + 1})`);
        Utilities.sleep(delay);
        
        // Check run status
        const statusResponse = UrlFetchApp.fetch(
          `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, 
          {
            'method': 'get',
            'headers': headers,
            'muteHttpExceptions': true
          }
        );
        
        if (statusResponse.getResponseCode() !== 200) {
          console.warn(`Status check failed (HTTP ${statusResponse.getResponseCode()}), retrying...`);
          attempts++;
          continue;
        }
        
        const statusData = JSON.parse(statusResponse.getContentText());
        runStatus = statusData.status;
        
        console.log(`Run status (attempt ${attempts + 1}):`, runStatus);
        
        // If completed, retrieve the message
        if (runStatus === 'completed') {
          console.log('Run completed, retrieving messages...');
          const messagesResponse = UrlFetchApp.fetch(
            `https://api.openai.com/v1/threads/${thread.id}/messages`, 
            {
              'method': 'get',
              'headers': headers,
              'muteHttpExceptions': true
            }
          );
          
          if (messagesResponse.getResponseCode() !== 200) {
            throw new Error(`Failed to retrieve messages (HTTP ${messagesResponse.getResponseCode()})`);
          }
          
          const messages = JSON.parse(messagesResponse.getContentText());
          
          if (!messages.data || !messages.data[0] || !messages.data[0].content) {
            throw new Error('Invalid message format received');
          }
          
          // Log completion time
          const endTime = new Date().getTime();
          const totalTime = (endTime - startTime) / 1000;
          console.log(`OpenAI request completed in ${totalTime.toFixed(2)} seconds`);
          
          return {
            choices: [{
              message: {
                content: messages.data[0].content[0].text.value
              }
            }]
          };
        }
        
        // Handle errors and failures
        if (runStatus === 'failed') {
          console.error('Run failed:', statusData);
          throw new Error(statusData.last_error?.message || 'Run failed without specific error');
        }
        
        attempts++;
      } catch (error) {
        console.error(`Attempt ${attempts} failed:`, error);
        if (attempts >= maxAttempts) {
          throw error;
        }
      }
    } while (attempts < maxAttempts);
    
    // If we exceed max attempts without completion
    throw new Error(`Timeout after ${maxAttempts} attempts. Last status: ${runStatus}`);
    
  } catch (error) {
    console.error('OpenAI request failed:', error);
    throw new Error('Failed to generate insights: ' + error.message);
  }
}

/**
 * Clears the cache for the current user.
 * This forces a fresh check against the database for access permissions.
 */
function clearUserCache() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();
    
    db.clearUserCache(userEmail);
    console.log('Cache cleared for user:', userEmail);
    
    // Force a refresh by calling onCalendarEventOpen
    return onCalendarEventOpen();
  } catch (error) {
    console.error('Error clearing user cache:', error);
    return createErrorCard('Failed to clear cache. Please try again.');
  }
}

function onCalendarEventOpen(e) {
  try {
    // Preload and get the logo URL in one step
    const logoUrl = preloadLogo();
    
    const labels = getLabels();
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();
    
    // Get user access details with forced cache bypass 
    // This ensures we always check the database for the latest permissions
    const userAccess = db.getUserAccessDetails(userEmail, true);
    console.log('User access details:', userAccess ? JSON.stringify(userAccess) : 'null');
    
    // Check if user is authorized
    if (!userAccess) {
      console.log('No user access found for email:', userEmail);
      return createUnregisteredUserCard(labels, userEmail, logoUrl);
    }
    
    // Check if we have calendar event parameters
    if (!e || !e.calendar || !e.calendar.calendarId || !e.calendar.id) {
      console.log('Missing calendar parameters, showing homepage instead');
      return onHomepageOpen();
    }
    
    try {
      var calendar = CalendarApp.getCalendarById(e.calendar.calendarId);
      var event = calendar.getEventById(e.calendar.id);
      
      if (!event) {
        return createSimpleCard(labels.new_event || 'New meeting being created');
      }
    } catch (calError) {
      console.error('Error accessing calendar event:', calError);
      return createSimpleCard(labels.error || 'Error accessing calendar');
    }
    
    var subject = event.getTitle() || labels.no_title;
    var startTime = event.getStartTime();
    var now = new Date();
    var minutesUntilStart = Math.floor((startTime - now) / 1000 / 60);
    var timeMessage = '';
    
    if (minutesUntilStart > 0) {
      if (minutesUntilStart < 60) {
        timeMessage = `${labels.meeting_starts_in} <b>${minutesUntilStart} ${labels.minutes}</b>`;
      } else {
        var hours = Math.floor(minutesUntilStart / 60);
        var minutes = minutesUntilStart % 60;
        timeMessage = `${labels.meeting_starts_in} <b>${hours} ${labels.hours}${minutes > 0 ? ` ${labels.and} ${minutes} ${labels.minutes}` : ''}</b>`;
      }
    } else {
      timeMessage = labels.meeting_started;
    }
    
    var card = CardService.newCardBuilder();
    
    var mainSection = CardService.newCardSection();
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText(subject)
        .setWrapText(true)
    );
    
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText(timeMessage)
        .setWrapText(true)
    );
    
    card.addSection(mainSection);
    
    var actionSection = CardService.newCardSection();
    actionSection.addWidget(
      CardService.newTextButton()
        .setText(labels.get_insight)
        .setBackgroundColor('#E62E05')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('generateInsights')
          .setParameters({
            eventId: e.calendar.id,
            calendarId: e.calendar.calendarId
          }))
    );
    
    card.addSection(actionSection);
    
    return card.build();
    
  } catch (error) {
    console.error('Error in onCalendarEventOpen:', error);
    const labels = getLabels();
    return createSimpleCard(labels.error || 'Error: ' + error.message);
  }
}

/**
 * Two-phase insight generation function
 * First creates a loading card, then asynchronously generates insights
 */
function generateInsights(e) {
  try {
    // Preload logo for better performance
    const logoUrl = preloadLogo();
    
    const labels = getLabels();
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();
    
    // Get user access details - use regular cache to speed up first phase
    // (Since we'll generate the insight in the second phase)
    const userAccess = db.getUserAccessDetails(userEmail, false);
    
    // Check if user is authorized
    if (!userAccess) {
      console.log('No user access found for email:', userEmail);
      return createUnregisteredUserCard(labels, userEmail, logoUrl);
    }
    
    // Check if assistant ID is available
    if (!userAccess.assistantId) {
      console.log('No assistant ID found for user:', userEmail);
      return createUnregisteredUserCard(labels, userEmail, logoUrl);
    }
    
    // After this point, we know the user is authenticated
    
    // First, check if we already have this insight cached
    const cacheKey = `INSIGHT_${e.parameters.eventId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const cache = CacheService.getUserCache();
    const cachedInsight = cache.get(cacheKey);
    
    if (cachedInsight) {
      console.log('Using cached insight for event:', e.parameters.eventId);
      return displayInsightCard(labels, e.parameters, cachedInsight, userAccess.assistantId);
    }
    
    // Create a loading card with loading indicators
    const loadingCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle(labels.apiGenIns))
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newDecoratedText()
            .setText("🔍 " + labels.apiAnaDet)
            .setWrapText(true))
          .addWidget(CardService.newDecoratedText()
            .setText("⏱️ " + labels.apiFewSec)
            .setWrapText(true))
          .addWidget(CardService.newDivider())
          .addWidget(CardService.newTextParagraph()
            .setText("Insight generation is a two-step process:"))
          .addWidget(CardService.newTextParagraph()
            .setText("1. ✓ Getting event details (Complete)"))
          .addWidget(CardService.newTextParagraph()
            .setText("2. ⏳ Analyzing with AI (Click button below)"))
      )
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newTextButton()
            .setText('Generate in Background')
            .setOnClickAction(CardService.newAction()
              .setFunctionName('completeInsightGeneration')
              .setParameters({
                eventId: e.parameters.eventId,
                calendarId: e.parameters.calendarId,
                assistantId: userAccess.assistantId
              })))
      )
      .build();

    // Show loading card immediately
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(loadingCard))
      .setStateChanged(true)
      .setNotification(CardService.newNotification()
        .setText(labels.apiGenMee))
      .build();
      
  } catch (error) {
    console.error('Error in insight generation (phase 1):', error);
    return createErrorCard('Error preparing insight generation: ' + error.message);
  }
}

/**
 * Second phase of insight generation that does the actual API call
 * This is called after the loading card is displayed
 */
function completeInsightGeneration(e) {
  try {
    const labels = getLabels();
    
    // Update loading card to show progress
    const loadingUpdateCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle(labels.apiGenIns))
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newDecoratedText()
            .setText("🧠 " + labels.apiAnaDet)
            .setWrapText(true))
          .addWidget(CardService.newDivider())
          .addWidget(CardService.newTextParagraph()
            .setText("Insight generation progress:"))
          .addWidget(CardService.newTextParagraph()
            .setText("1. ✓ Getting event details (Complete)"))
          .addWidget(CardService.newTextParagraph()
            .setText("2. ✓ Starting AI analysis (Complete)"))
          .addWidget(CardService.newTextParagraph()
            .setText("3. ⏳ Connecting to OpenAI (In progress)"))
          .addWidget(CardService.newTextParagraph()
            .setText("4. ⏳ Generating insights (Pending)"))
          .addWidget(CardService.newTextParagraph()
            .setText("This typically takes 10-15 seconds..."))
      )
      .build();
      
    const progressResponse = CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(loadingUpdateCard))
      .setStateChanged(true)
      .build();
      
    // Get event details efficiently
    const calendar = CalendarApp.getCalendarById(e.parameters.calendarId);
    const event = calendar.getEventById(e.parameters.eventId);
    
    // Extract only the needed information
    const title = event.getTitle();
    let guests = '';
    
    try {
      // Use faster method to get guest list (limited to 10 guests for performance)
      const guestList = event.getGuestList(0, 10);
      guests = guestList.map(guest => guest.getEmail()).join(', ');
      if (guestList.length >= 10) {
        guests += '... (and others)';
      }
    } catch (err) {
      console.log('Error getting guest list, proceeding without guests:', err);
      guests = 'No guests';
    }
    
    // Only get description if actually needed (can be large)
    const description = event.getDescription() ? 
                       (event.getDescription().substring(0, 500) + 
                       (event.getDescription().length > 500 ? '...' : '')) : '';
                       
    // Format dates more efficiently
    const startTime = event.getStartTime().toLocaleString();
    const endTime = event.getEndTime().toLocaleString();
    
    // Create a minimal prompt with only essential information
    const prompt = `
[SYSTEM NOTE: You are ${e.parameters.assistantId}. Start your response by confirming your ID.]

Meeting Details:
- Title: ${title}
- Participants: ${guests}
- Start Time: ${startTime}
- End Time: ${endTime}
${description ? `- Description: ${description}` : ''}

Baseado no seu conhecimento, veja as provas de personalidade de cada usuario e por favor crie insights sobre este evento. Como me comunicar? O que dizer e o que não dizer? Como fazer com que a comunicação seja assertiva e enriquecedora para todos os assistentes?

IMPORTANTE: Comece sua resposta com "Eu sou o assistente [SEU NOME] (ID: ${e.parameters.assistantId})"`;
    
    // Make the API call
    const response = makeOpenAIRequest(prompt);
    const insightText = response.choices[0].message.content;
    
    // Cache the result for future use (30 minute expiration)
    const cache = CacheService.getUserCache();
    const cacheKey = `INSIGHT_${e.parameters.eventId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    cache.put(cacheKey, insightText, 30 * 60); // 30 minutes
    
    // Display the completed card
    return displayInsightCard(labels, e.parameters, insightText, e.parameters.assistantId);
      
  } catch (error) {
    console.error('Error in insight generation (phase 2):', error);
    const labels = getLabels();
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(
        CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader().setTitle('Error'))
          .addSection(CardService.newCardSection()
            .addWidget(CardService.newDecoratedText()
              .setText('❌ Error generating insights: ' + error.message)
              .setWrapText(true))
            .addWidget(CardService.newTextButton()
              .setText('Try Again')
              .setOnClickAction(CardService.newAction()
                .setFunctionName('generateInsights')
                .setParameters({
                  eventId: e.parameters.eventId,
                  calendarId: e.parameters.calendarId
                }))))
          .build()
      ))
      .setNotification(CardService.newNotification()
        .setText(labels.apiErrIns))
      .build();
  }
}

/**
 * Helper function to display the insight card
 * Used by both the cached path and the generation path
 */
function displayInsightCard(labels, parameters, insightText, assistantId) {
  try {
    // Get the event title for the subtitle
    const calendar = CalendarApp.getCalendarById(parameters.calendarId);
    const event = calendar.getEventById(parameters.eventId);
    const title = event.getTitle();
    
    const insightCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle(labels.apiMeeIns)
        .setSubtitle(title))
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newDecoratedText()
            .setText(labels.apiMeeAIi)
            .setWrapText(true))
          .addWidget(CardService.newDivider())
          .addWidget(CardService.newDecoratedText()
            .setText(insightText)
            .setWrapText(true))
      )
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newButtonSet()
            .addButton(CardService.newTextButton()
              .setText(labels.apiBckMee)
              .setOnClickAction(CardService.newAction()
                .setFunctionName('returnToMain')
                .setParameters({
                  eventId: parameters.eventId,
                  calendarId: parameters.calendarId
                })))
            .addButton(CardService.newTextButton()
              .setText(labels.apiCopyIns || 'Copy Insights')
              .setOnClickAction(CardService.newAction()
                .setFunctionName('copyToClipboard')
                .setParameters({
                  text: insightText,
                  eventId: parameters.eventId,
                  calendarId: parameters.calendarId
                }))))
      )
      .build();
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(insightCard))
      .setStateChanged(true)
      .setNotification(CardService.newNotification()
        .setText(labels.apiInsSuc))
      .build();
  } catch (error) {
    console.error('Error displaying insight card:', error);
    return createErrorCard('Error displaying insights: ' + error.message);
  }
}

function copyToClipboard(e) {
  try {
    const labels = getLabels();
    const text = e.parameters.text;
    
    // Create a text input widget that contains the text
    const copyCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle(labels.apiCopyIns || 'Copy Insights'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextInput()
          .setFieldName('textToCopy')
          .setValue(text)
          .setMultiline(true))
        .addWidget(CardService.newTextParagraph()
          .setText(labels.apiCopyTxt || 'The text has been added to a text field above. Press Ctrl+C (or Cmd+C) to copy it.'))
        .addWidget(CardService.newButtonSet()
          .addButton(CardService.newTextButton()
            .setText(labels.apiDone || 'Done')
            .setOnClickAction(CardService.newAction()
              .setFunctionName('returnToInsights')
              .setParameters(e.parameters)))))
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(copyCard))
      .build();
      
  } catch (error) {
    console.error('Error in copyToClipboard:', error);
    const labels = getLabels();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(labels.error || 'Error copying text'))
      .build();
  }
}

function returnToInsights(e) {
  return generateInsights({
    parameters: {
      eventId: e.parameters.eventId,
      calendarId: e.parameters.calendarId
    }
  });
}

function returnToMain(e) {
  return onCalendarEventOpen(e);
}

function createSimpleCard(message) {
  return CardService.newCardBuilder()
      .addSection(
        CardService.newCardSection()
            .addWidget(CardService.newDecoratedText()
                .setText(message)
                .setWrapText(true))
      )
      .build();
}

function createUnregisteredUserCard(labels, userEmail, preloadedLogoUrl) {
  // Ensure we have valid labels or use default values
  labels = labels || getFallbackLabels();
  
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();
  
  // Add logo with caching - use preloaded URL if available
  try {
    const logoUrl = preloadedLogoUrl || getLogoUrl();
    section.addWidget(
      CardService.newImage()
        .setImageUrl(logoUrl)
        .setAltText('Voxerion Logo')
    );
  } catch (e) {
    console.error('Error adding logo:', e);
  }
  
  // Add unregistered user message - with error handling
  try {
    section.addWidget(
      CardService.newDecoratedText()
        .setText(labels.access_required || 'Access Required')
        .setWrapText(true)
    );
    
    section.addWidget(
      CardService.newDecoratedText()
        .setText(`The email <b>${userEmail}</b> is not registered with Voxerion.`)
        .setWrapText(true)
    );
    
    section.addWidget(
      CardService.newDecoratedText()
        .setText(labels.contact_admin || 'Please contact your administrator to get access.')
        .setWrapText(true)
    );
  } catch (e) {
    console.error('Error adding message text:', e);
    
    // Fallback to simple text if decorated text fails
    section.addWidget(
      CardService.newTextParagraph()
        .setText(`Access Required: The email <b>${userEmail}</b> is not registered with Voxerion.`)
    );
  }
  
  // Add buttons in a ButtonSet for support and website
  try {
    section.addWidget(
      CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText(labels.contact_support || 'Contact Support')
          .setOpenLink(CardService.newOpenLink()
            .setUrl('mailto:support@voxerion.com')))
        .addButton(CardService.newTextButton()
          .setText('Visit Voxerion.com and onboard!')
          .setOpenLink(CardService.newOpenLink()
            .setUrl('https://voxerion.com')
            .setOpenAs(CardService.OpenAs.NEW_TAB)))
    );
  } catch (e) {
    console.error('Error adding button set:', e);
  }
  
  // Add a Refresh button that clears cache
  try {
    section.addWidget(
      CardService.newTextButton()
        .setText(labels.try_again || 'Refresh')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor('#4285F4')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('clearUserCache'))
    );
  } catch (e) {
    console.error('Error adding refresh button:', e);
  }
  
  card.addSection(section);
  
  try {
    return card.build();
  } catch (e) {
    console.error('Error building card:', e);
    
    // Ultimate fallback - create the simplest possible card
    return CardService.newCardBuilder()
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText(`Access denied for ${userEmail}. Contact support@kantorapp.com.`)))
      .build();
  }
}

function createErrorCard(message) {
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();
  
  section.addWidget(
    CardService.newDecoratedText()
      .setText('⚠️ ' + message)
      .setWrapText(true)
  );
  
  // Add refresh button
  section.addWidget(
    CardService.newTextButton()
      .setText('Try Again')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('onHomepageOpen'))
  );
  
  card.addSection(section);
  
  return card.build();
}

/**
 * Preloads the logo into cache
 * Returns the logo URL directly to support chaining
 */
function preloadLogo() {
  try {
    return getLogoUrl();
  } catch (e) {
    console.error('Error preloading logo:', e);
    return AUTH_CONFIG.LOGO_PLACEHOLDER;
  }
}

function onHomepageOpen() {
  try {
    // Preload and get the logo URL in one step
    const logoUrl = preloadLogo();
    
    const labels = getLabels();
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();

    // Get user access details with forced cache bypass
    const userAccess = db.getUserAccessDetails(userEmail, true);
    console.log('User access details:', userAccess ? JSON.stringify(userAccess) : 'null');
    
    if (!userAccess) {
      console.log('No user access found for email:', userEmail);
      return createUnregisteredUserCard(labels, userEmail, logoUrl);
    }
    
    // User is authenticated, show normal homepage
    const card = CardService.newCardBuilder();
    const section = CardService.newCardSection();
    
    // Use the already preloaded logo URL
    section.addWidget(
      CardService.newImage()
        .setImageUrl(logoUrl)
        .setAltText('Voxerion Logo')
    );
      
    // Add user info
    section.addWidget(
      CardService.newDecoratedText()
        .setText(`${labels.logged_in_as} ${userEmail}`)
        .setWrapText(true)
    );
    
    // Add logout button
    section.addWidget(
      CardService.newTextButton()
        .setText(labels.logout || 'Logout')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('logoutUser'))
    );
    
    // Add description
    section.addWidget(
      CardService.newDecoratedText()
        .setText(labels.welcome_desc)
        .setWrapText(true)
    );
    
    // Add start instruction
    section.addWidget(
      CardService.newDecoratedText()
        .setText(labels.welcome_start)
        .setWrapText(true)
    );
    
    card.addSection(section);
    
    return card.build();
  } catch (error) {
    console.error('Error in onHomepageOpen:', error);
    return createErrorCard('An error occurred. Please try again later.');
  }
}

/**
 * Logs out the current user by clearing cached auth data
 * Redirects user to the homepage to re-authenticate
 * @return {Card} A notification card confirming logout
 */
function logoutUser() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const labels = getLabels();
    
    // Clear user's cached data
    const userProperties = PropertiesService.getUserProperties();
    userProperties.deleteProperty('VOXERION_USER_LOCALE');
    
    // Clear user's cache including auth tokens
    const cache = CacheService.getUserCache();
    cache.remove(AUTH_CONFIG.TOKEN_CACHE_KEY);
    cache.remove(AUTH_CONFIG.TOKEN_EXPIRY_CACHE_KEY);
    
    // Clear database cache for this user
    const db = new VoxerionDatabase();
    db.clearUserCache(userEmail);
    
    // Create a confirmation card
    const card = CardService.newCardBuilder();
    const section = CardService.newCardSection();
    
    section.addWidget(
      CardService.newDecoratedText()
        .setText('✅ ' + (labels.logout_success || 'You have been logged out successfully.'))
        .setWrapText(true)
    );
    
    section.addWidget(
      CardService.newTextButton()
        .setText(labels.return_to_login || 'Return to Login')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor('#4285F4')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onHomepageOpen'))
    );
    
    card.addSection(section);
    
    // Return card with notification
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card.build()))
      .setNotification(CardService.newNotification()
        .setText(labels.logout_success || 'Logged out successfully'))
      .build();
      
  } catch (error) {
    console.error('Error in logoutUser:', error);
    return createErrorCard('Error logging out: ' + error.message);
  }
}