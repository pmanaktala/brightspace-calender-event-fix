function fetchAndParseICS() {
  Logger.log('Starting fetchAndParseICS');
  var icsUrl = 'https://purdue.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=algl37m07zo27sum2c069';
  var response = UrlFetchApp.fetch(icsUrl);
  var icsData = response.getContentText();
  Logger.log('Fetched ICS data');

  // Split the ICS content into lines and parse it
  var lines = icsData.split("\r\n");
  var events = [];
  var event = null;

  //Custom logic for extracting lines into event object
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (line.startsWith("BEGIN:VEVENT")) {
      event = {};
    } else if (line.startsWith("END:VEVENT")) {
      //Add current event to the event array.
      events.push(event);
      event = null;
    } else if (event) {
      if (line.startsWith("DESCRIPTION:")) {
        var key = "DESCRIPTION";
        var value = line.substring("DESCRIPTION:".length);
        event[key] = value.replace(/\\,/g, ',').replace(/\\n/g, '\n'); // Unescape commas and handle new lines
      } else if (line[0] === ' ' || line[0] === '\t') { // Check if line is a continuation of DESCRIPTION
        // Append to the last DESCRIPTION, removing first character and unescaping commas, handling new lines
        event["DESCRIPTION"] += line.substring(1).replace(/\\,/g, ',').replace(/\\n/g, '\n');
      } else {
        var [key, value] = line.split(":");
        event[key] = value;
      }
    }
  }

  Logger.log('Parsed ' + events.length + ' events');
  // Adjust events and create them in Google Calendar
  adjustAndCreateEvents(events);
}

function adjustAndCreateEvents(events) {
  Logger.log('Starting adjustAndCreateEvents with ' + events.length + ' events');
  var calendarId = '357042073c689d245cf1db2524998127605f0a7954f83ab057719397f2c22e89@group.calendar.google.com';
  var calendar = CalendarApp.getCalendarById(calendarId);

  events.forEach(function (event, index) {

    //I just needed one specific calender event
    if (event['LOCATION'] == "Spring 2024 ACS 56700-01 Software Proj Mgmnt LEC") {
      var startTime = parseIcsDate(event["DTSTART"]);
      var endTime = parseIcsDate(event["DTEND"]);

      //Generating a unique event identifier to make sure duplicate events are not added in the calender every time script runs
      var eventIdentifier = generateEventIdentifier(event["SUMMARY"], startTime, endTime);
      Logger.log('Generated event identifier: ' + eventIdentifier);

      if (!eventExists(calendar, eventIdentifier, startTime, endTime)) {
        Logger.log('Event does not exist, creating new event');
        var duration = endTime - startTime;
        if (duration <= 60000) {
          endTime = new Date(startTime.getTime() + 3600000); // Adjusting to add 1 hour, can be changed according to the need.
          Logger.log('Adjusted event duration to 1 hour');
        }

        calendar.createEvent(event["SUMMARY"], startTime, endTime, {
          description: (event["DESCRIPTION"] || '') + '\n\nIdentifier: ' + eventIdentifier,
          location: event["LOCATION"] || ''
        });
        Logger.log('Event created');
      } else {
        Logger.log('Event already exists, skipping creation');
      }
    }
  });
}

//Custom parsing logic for date, date/time are stupid in brightspace, guess what? agian!.
function parseIcsDate(dateStr) {
  var match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (!match) {
    throw new Error('Invalid date format');
  }
  var year = +match[1],
    month = +match[2] - 1, // Adjust month for JavaScript Date (0-based index)
    day = +match[3],
    hour = +match[4],
    minute = +match[5],
    second = +match[6];

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

function generateEventIdentifier(summary, startTime, endTime) {
  return summary + '-' + startTime.toISOString() + '-' + endTime.toISOString();
}

function eventExists(calendar, identifier, startTime, endTime) {
  Logger.log('Checking if event exists: ' + identifier);
  var searchStartTime = new Date(startTime.getTime() - (24 * 60 * 60 * 1000)); // 1 day before
  var searchEndTime = new Date(endTime.getTime() + (24 * 60 * 60 * 1000)); // 1 day after
  var events = calendar.getEvents(searchStartTime, searchEndTime);

  for (var i = 0; i < events.length; i++) {
    if (events[i].getDescription().indexOf(identifier) !== -1) {
      return true;
    }
  }
  return false;
}
