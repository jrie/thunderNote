// Localization
function getFirefoxMessage (messageName, params) {
  if (params !== undefined) return browser.i18n.getMessage(messageName, params)
  return browser.i18n.getMessage(messageName)
}

let getMsg = getFirefoxMessage

// -------------------------------------------------------------------------------------------------------

function handleAlarms (evt) {
  browser.storage.local.get('feeds').then( function (data) {
    if (data['feeds'] === undefined) return

    if (data['feeds'][evt.name][0] === 'rss') handleRSS(evt.name)
    // TODO: else => handleWebpage
  }, errorHandle)
}

// -------------------------------------------------------------------------------------------------------

function handleRSS (URI) {
  let request = new XMLHttpRequest()

  request.addEventListener('readystatechange', function (evt) {
    if (evt.target.readyState === 4) {
      if (evt.target.status === 200) {
        if (processXMLData(evt.target.responseXML, URI)) {
          browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('RSSupdateTitle'), 'message': getMsg('RSSupdateInformation', URI) })
          return
        }
      }

      browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('RSSupdateFailTitle'), 'message': getMsg('RSSupdateInformation', URI) })
    }
  })

  request.timeout = 30000
  request.open('GET', URI)
  request.send()
}

// -------------------------------------------------------------------------------------------------------
function processXMLData (xmlDoc, URI) {
  let x2js = new X2JS()
  let json = x2js.xml2json(xmlDoc)

  let jsonData
  if (json['channel'] !== undefined) {
    jsonData = json['channel']
  } else if (json['rss'] !== undefined || json['rss']['channel'] !== undefined) {
    jsonData = json['rss']['channel']
  }

  if (jsonData === undefined) return false

  browser.storage.local.get('keywords').then(function (keywordData) {
    if (keywordData === undefined) return true

    for (let keyword of Object.keys(keywordData['keywords']['cnt'])) {
      for (let item of jsonData['item']) {
        let link = item['link']
        let title = item['title']
        let description = item['description']
        let time = Date.parse(item['pubDate'])

        let itemData = [link, title, description]

        if (item['encoded'] !== undefined) {
          let mediaMatch = item['encoded'].toString().match(/img src='((http|https):\/\/.*\.(jpg|jpeg|png|gif|webm|mp4|tiff))/i)
          if (mediaMatch !== null && mediaMatch[1] !== undefined) itemData.push(mediaMatch[1])
          itemData.push(item['encoded'].toString())
        }

        let keyRegEx = new RegExp(keyword, 'gm')

        for (let element of itemData) {
          let matches = element.match(keyRegEx)

          if (matches !== null) {
            if (keywordData['keywords']['urls'][keyword] === undefined) keywordData['keywords']['urls'][keyword] = {}
            if (keywordData['keywords']['urls'][keyword][link] === undefined) keywordData['keywords']['urls'][keyword][link] = [title, matches.length, time, description, URI]
            else {
              keywordData['keywords']['urls'][keyword][link][0] = title
              keywordData['keywords']['urls'][keyword][link][2] = time
              keywordData['keywords']['urls'][keyword][link][3] = description
              keywordData['keywords']['urls'][keyword][link][4] = URI
            }
          }
        }
      }

      keywordData['keywords']['cnt'][keyword] = Object.keys(keywordData['keywords']['urls'][keyword]).length
      browser.storage.local.set(keywordData)
    }
  }, errorHandle)

  return true
}

// -------------------------------------------------------------------------------------------------------

function addKeyword (keywordData, info) {
  if (keywordData['keywords'] === undefined) keywordData['keywords'] = { 'cnt': {}, 'urls': {} }
  let keywordText = info['linkText'] !== undefined ? info['linkText'] : info['selectionText']
  keywordText = keywordText.trim()

  if (keywordText.length === 0) return
  if (keywordData['keywords']['cnt'][keywordText] !== undefined) return

  keywordData['keywords']['cnt'][keywordText] = 0

  if (keywordData['keywords']['urls'] === undefined) keywordData['keywords']['urls'] = {}
  browser.storage.local.set(keywordData)
  browser.runtime.sendMessage({ 'addKeyword': keywordText })
}

// -------------------------------------------------------------------------------------------------------

function errorHandle (error) {
  console.warn('An error occured:')
  console.warn(error)
}

// -------------------------------------------------------------------------------------------------------

browser.alarms.onAlarm.addListener(handleAlarms)
browser.contextMenus.create({ title: getMsg('contextMenuAddKeyword'), contexts: ['link', 'selection'], onclick (info) { browser.storage.local.get('keywords').then(function (data) { addKeyword(data, info) }, errorHandle) } })

browser.storage.local.get().then(function (data) {
  browser.alarms.clearAll()
  if ((data['addon'] === undefined || data['addon']['status'] === undefined) || data['addon']['status'] === 'enabled') {
    for (let url of Object.keys(data['feeds'])) {
      browser.alarms.create(url, { 'when': Date.now() + 2000, 'periodInMinutes': data['feeds'][url][1] })
    }
  }
}, errorHandle)
