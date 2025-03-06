// Auth service configuration
const AUTH_CONFIG = {
  TOKEN_CACHE_KEY: 'VOXERION_AUTH_TOKEN',
  TOKEN_EXPIRY_CACHE_KEY: 'VOXERION_TOKEN_EXPIRY',
  DB_SPREADSHEET_ID: '1UfwaFLwXeyWfq2wuhL5e1-xa2pqoHX66sjYatAvVOgk' // Replace with your database spreadsheet ID
};

// Function to get labels from CSV in Drive
function getLabels() {
  try {
    const fileId = '17WSQ7I3Tz7SJeHluxHoQWVuuQEunr4xF';
    const file = DriveApp.getFileById(fileId);
    const csvContent = file.getBlob().getDataAsString();
    
    const labels = {};
    const rows = Utilities.parseCsv(csvContent);
    
    const headerRow = rows[0];
    const languageIndex = headerRow.indexOf('pt'); // or 'pt', 'es' etc.
    
    for (let i = 1; i < rows.length; i++) {
      const key = rows[i][0];
      const value = rows[i][languageIndex];
      labels[key] = value;
    }
    
    return labels;
  } catch (error) {
    console.error('Error loading labels:', error);
    return getFallbackLabels();
  }
}

function getFallbackLabels() {
  return {
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
    access_required: '🔒 Access Required',
    contact_admin: 'Please contact your administrator to get access to Voxerion.',
    contact_support: 'Contact Support',
    try_again: 'Try Again',
    logged_in_as: 'Logged in as:'
  };
}

function makeOpenAIRequest(prompt) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();
    const userAccess = db.getUserAccessDetails(userEmail);
    
    if (!userAccess || !userAccess.assistantId) {
      throw new Error('User not authorized or Assistant ID not found');
    }

    // Get Voxerion's API key from Script Properties
    const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('System configuration error: API key not found');
    }

    const ASSISTANT_ID = userAccess.assistantId;
    console.log('Starting OpenAI request with Assistant ID:', ASSISTANT_ID);

    // 1. Validate Assistant ID first
    try {
      const validateRequest = {
        'method': 'get',
        'headers': {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      };
      
      const validateResponse = UrlFetchApp.fetch(`https://api.openai.com/v1/assistants/${ASSISTANT_ID}`, validateRequest);
      const assistant = JSON.parse(validateResponse.getContentText());
      console.log('Assistant validated:', assistant.id);
    } catch (error) {
      console.error('Assistant validation failed:', error);
      throw new Error(`Invalid Assistant ID: ${ASSISTANT_ID}`);
    }

    // 2. Create thread with error handling
    let thread;
    try {
      const threadRequest = {
        'method': 'post',
        'headers': {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      };
      
      const threadResponse = UrlFetchApp.fetch('https://api.openai.com/v1/threads', threadRequest);
      thread = JSON.parse(threadResponse.getContentText());
      console.log('Thread created:', thread.id);
    } catch (error) {
      console.error('Thread creation failed:', error);
      throw new Error('Failed to create conversation thread');
    }
    
    // 3. Add message with error handling
    try {
      const messageRequest = {
        'method': 'post',
        'headers': {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        'payload': JSON.stringify({
          'role': 'user',
          'content': prompt
        })
      };
      
      const messageResponse = UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, messageRequest);
      console.log('Message added successfully');
    } catch (error) {
      console.error('Message addition failed:', error);
      throw new Error('Failed to add message to thread');
    }
    
    // 4. Run assistant with error handling
    let run;
    try {
      const runRequest = {
        'method': 'post',
        'headers': {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        'payload': JSON.stringify({
          'assistant_id': ASSISTANT_ID
        })
      };
      
      const runResponse = UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, runRequest);
      run = JSON.parse(runResponse.getContentText());
      console.log('Run created:', run.id);
    } catch (error) {
      console.error('Run creation failed:', error);
      throw new Error('Failed to start assistant');
    }
    
    // 5. Check status with improved error handling
    let runStatus;
    let attempts = 0;
    const maxAttempts = 7;
    let lastError = null;
    
    do {
      try {
        Utilities.sleep(1000); // Increased wait time
        
        const statusRequest = {
          'method': 'get',
          'headers': {
            'Authorization': 'Bearer ' + apiKey,
            'OpenAI-Beta': 'assistants=v2'
          }
        };
        
        const statusResponse = UrlFetchApp.fetch(
          `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, 
          statusRequest
        );
        const statusData = JSON.parse(statusResponse.getContentText());
        runStatus = statusData.status;
        
        console.log(`Run status attempt ${attempts + 1}:`, runStatus, statusData);
        
        if (runStatus === 'completed') {
          try {
            const messagesRequest = {
              'method': 'get',
              'headers': {
                'Authorization': 'Bearer ' + apiKey,
                'OpenAI-Beta': 'assistants=v2'
              }
            };
            
            const messagesResponse = UrlFetchApp.fetch(
              `https://api.openai.com/v1/threads/${thread.id}/messages`, 
              messagesRequest
            );
            const messages = JSON.parse(messagesResponse.getContentText());
            
            if (!messages.data || !messages.data[0] || !messages.data[0].content) {
              throw new Error('Invalid message format received');
            }
            
            return {
              choices: [{
                message: {
                  content: messages.data[0].content[0].text.value
                }
              }]
            };
          } catch (error) {
            console.error('Message retrieval failed:', error);
            throw new Error('Failed to retrieve assistant response');
          }
        }
        
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
    
    throw new Error(`Timeout after ${maxAttempts} attempts. Last status: ${runStatus}`);
    
  } catch (error) {
    console.error('OpenAI request failed:', error);
    throw new Error('Failed to generate insights: ' + error.message);
  }
}
function onCalendarEventOpen(e) {
  try {
    const labels = getLabels();
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();
    
    // Verify user access
    try {
      const userAccess = db.getUserAccessDetails(userEmail);
      if (!userAccess) {
        return createUnregisteredUserCard(labels, userEmail);
      }
    } catch (error) {
      console.error('User validation error:', error);
      return createUnregisteredUserCard(labels, userEmail);
    }
    
    var calendar = CalendarApp.getCalendarById(e.calendar.calendarId);
    var event = calendar.getEventById(e.calendar.id);
    
    if (!event) {
      return createSimpleCard(labels.new_event);
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
        .setBackgroundColor('#F6B026')
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

function generateInsights(e) {
  try {
    const labels = getLabels();
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();
    let userAccess;
    
    // Verify user access - isolated in its own try-catch
    try {
      userAccess = db.getUserAccessDetails(userEmail);
      console.log('User access details:', JSON.stringify(userAccess));
      
      if (!userAccess) {
        console.log('No user access found');
        return createUnregisteredUserCard(labels, userEmail);
      }
      if (!userAccess.assistantId) {
        console.log('No assistant ID found');
        return createUnregisteredUserCard(labels, userEmail);
      }
      console.log('Will use Assistant ID:', userAccess.assistantId);
    } catch (error) {
      console.error('User validation error:', error);
      return createUnregisteredUserCard(labels, userEmail);
    }
    
    // After this point, we know the user is authenticated
    const loadingCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle(labels.apiGenIns))
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newDecoratedText()
            .setText(labels.apiAnaDet)
            .setWrapText(true))
          .addWidget(CardService.newDecoratedText()
            .setText(labels.apiFewSec)
            .setWrapText(true))
      )
      .build();

    const loadingResponse = CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(loadingCard))
      .setStateChanged(true)
      .setNotification(CardService.newNotification()
        .setText(labels.apiGenMee))
      .build();

    const calendar = CalendarApp.getCalendarById(e.parameters.calendarId);
    const event = calendar.getEventById(e.parameters.eventId);
    
    const guests = event.getGuestList().map(guest => guest.getEmail()).join(', ');
    const title = event.getTitle();
    const description = event.getDescription() || '';
    const startTime = event.getStartTime();
    const endTime = event.getEndTime();
    
    const prompt = `
[SYSTEM NOTE: You are ${userAccess.assistantId}. Always start your response by confirming your ID.]

Meeting Details:
- Title: ${title}
- Participants: ${guests}
- Description: ${description}
- Start Time: ${startTime}
- End Time: ${endTime}

Baseado no seu conhecimento, veja as provas de personalidade de cada usuario e por favor crie insights sobre este evento. Como me comunicar? O que dizer e o que não dizer? Como fazer com que a comunicação seja assertiva e enriquecedora para todos os assistentes?

IMPORTANTE: Comece sua resposta com "Eu sou o assistente [SEU NOME] (ID: ${userAccess.assistantId})"`;
    
    const response = makeOpenAIRequest(prompt);
    const insightText = response.choices[0].message.content;
    
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
                  eventId: e.parameters.eventId,
                  calendarId: e.parameters.calendarId
                })))
            .addButton(CardService.newTextButton()
              .setText(labels.apiCopyIns || 'Copy Insights')
              .setOnClickAction(CardService.newAction()
                .setFunctionName('copyToClipboard')
                .setParameters({
                  text: insightText,
                  eventId: e.parameters.eventId,
                  calendarId: e.parameters.calendarId
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
    const labels = getLabels();
    console.error('Error generating insights:', error);
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

function createUnregisteredUserCard(labels, userEmail) {
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();
  
  // Add logo
  section.addWidget(
    CardService.newImage()
      .setImageUrl('https://drive.google.com/uc?export=view&id=1-UmNKwwn-HUrv-a9tDKUu_lOYY50BiUI')
      .setAltText('Voxerion Logo')
  );
  
  // Add unregistered user message
  section.addWidget(
    CardService.newDecoratedText()
      .setText(labels.access_required)
      .setWrapText(true)
  );
  
  section.addWidget(
    CardService.newDecoratedText()
      .setText(`The email ${userEmail} is not registered with Voxerion.`)
      .setWrapText(true)
  );
  
  section.addWidget(
    CardService.newDecoratedText()
      .setText(labels.contact_admin)
      .setWrapText(true)
  );
  
  // Add buttons in a ButtonSet
  section.addWidget(
    CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText(labels.contact_support)
        .setOpenLink(CardService.newOpenLink()
          .setUrl('mailto:support@voxerion.com')))
      .addButton(CardService.newTextButton()
        .setText('Visit voxerion.com')
        .setOpenLink(CardService.newOpenLink()
          .setUrl('https://voxerion.com')
          .setOpenAs(CardService.OpenAs.NEW_TAB)))
  );
  
  card.addSection(section);
  
  return card.build();
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

function onHomepageOpen() {
  try {
    const labels = getLabels();
    const userEmail = Session.getActiveUser().getEmail();
    const db = new VoxerionDatabase();

    // Try to validate user access
    try {
      const userAccess = db.getUserAccessDetails(userEmail);
      
      if (!userAccess) {
        return createUnregisteredUserCard(labels, userEmail);
      }
      
      // User is authenticated, show normal homepage
      const card = CardService.newCardBuilder();
      const section = CardService.newCardSection();
      
      // Add title
      section.addWidget(
        CardService.newDecoratedText()
          .setText(labels.welcome_title)
          .setWrapText(true)
      );

      // Add logo
      section.addWidget(
        CardService.newImage()
          .setImageUrl('https://drive.google.com/uc?export=view&id=1-UmNKwwn-HUrv-a9tDKUu_lOYY50BiUI')
          .setAltText('Voxerion Logo')
      );
        
      // Add user info
      section.addWidget(
        CardService.newDecoratedText()
          .setText(`${labels.logged_in_as} ${userEmail}`)
          .setWrapText(true)
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
      // User not found or company not registered
      console.error('User validation error:', error);
      return createUnregisteredUserCard(labels, userEmail);
    }
  } catch (error) {
    console.error('Error in onHomepageOpen:', error);
    return createErrorCard('An error occurred. Please try again later.');
  }
}