// Localization
function getFirefoxMessage (messageName, params) {
  if (params !== undefined) return browser.i18n.getMessage(messageName, params)
  return browser.i18n.getMessage(messageName)
}

let getMsg = getFirefoxMessage

// -------------------------------------------------------------------------------------------------------

function handleAlarms (evt) {
  browser.storage.local.get('feeds').then(function (data) {
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
      if (evt.target.status === 200 || evt.target.status === 304) { // TODO: Create meaning with 304 - not modified since response
        if (processXMLData(evt.target.responseXML, URI)) {
          browser.storage.local.get('addon').then(function (data) {
            if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('RSSupdateTitle'), 'message': getMsg('RSSupdateInformation', URI) })
          })
          return
        }

        return
      }

      browser.storage.local.get('addon').then(function (data) {
        if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('RSSupdateFailTitle'), 'message': getMsg('RSSupdateInformation', URI) })
      })
    }
  })

  request.timeout = 30000
  request.open('GET', URI)
  request.send()
}

// -------------------------------------------------------------------------------------------------------
function processXMLData (xmlDoc, URI) {
  if (xmlDoc === null) {
    browser.storage.local.get('addon').then(function (data) {
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('RSSupdateFailTitle'), 'message': getMsg('RSSupdateInformation', URI) })
    })

    return false
  }

  let x2js = new X2JS()
  let json

  try {
    json = x2js.xml2json(xmlDoc)
  } catch (error) {
    browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('RSSupdateFailTitle'), 'message': getMsg('RSSupdateError', URI) })
    console.warn(getMsg('RSSupdateError', URI))
    console.warn(error)
    return false
  }

  let jsonData
  if (json['channel'] !== undefined) {
    jsonData = json['channel']
  } else if (json['rss'] !== undefined || json['rss']['channel'] !== undefined) {
    jsonData = json['rss']['channel']
  }

  if (jsonData['item'] === undefined) {
    return false
  }

  browser.storage.local.get().then(function (data) {
    if (data['feedData'] === undefined) data['feedData'] = {}
    if (data['feedData'][URI] === undefined) data['feedData'][URI] = {}
    else data['feedData'][URI] = {}

    for (let item of jsonData['item']) {
      let link = item['link']
      let title = item['title']
      let description = item['description']
      let time = Date.parse(item['pubDate'])

      let mediaMatch = null
      if (item['encoded'] !== undefined) {
        mediaMatch = item['encoded'].toString().match(/img src=["']((http|https):\/\/.*\.(jpg|jpeg|png|gif|webm|mp4|tiff))/i)
      }

      if (data['feedData'][URI][link] === undefined) {
        if (mediaMatch === null || mediaMatch[1] === undefined) data['feedData'][URI][link] = [title, time, description, link, null]
        else data['feedData'][URI][link] = [title, time, description, link, mediaMatch[1]]
      } else {
        data['feedData'][URI][link][0] = title
        data['feedData'][URI][link][1] = time
        data['feedData'][URI][link][2] = description
        data['feedData'][URI][link][3] = link
        if (mediaMatch !== null && mediaMatch[1] !== undefined) data['feedData'][URI][link][4] = mediaMatch[1]
      }
    }

    browser.storage.local.set(data)
  })

  browser.storage.local.get('keywords').then(function (keywordData) {
    if (keywordData === undefined) return true
    if (keywordData['keywords'] === undefined) return true

    for (let keyword of Object.keys(keywordData['keywords']['cnt'])) {
      for (let item of jsonData['item']) {
        let link = item['link']
        let title = item['title']
        let description = item['description']
        let time = Date.parse(item['pubDate'])

        let itemData = [link, title, description]
        let mediaMatch = null
        if (item['encoded'] !== undefined) {
          itemData.push(item['encoded'].toString())
          mediaMatch = item['encoded'].toString().match(/img src=["']((http|https):\/\/.*\.(jpg|jpeg|png|gif|webm|mp4|tiff))/i)
        }

        let keyRegEx = new RegExp(keyword, 'gm')

        for (let element of itemData) {
          let matches = element.match(keyRegEx)

          if (matches !== null) {
            if (keywordData['keywords']['urls'][keyword] === undefined) keywordData['keywords']['urls'][keyword] = {}
            if (keywordData['keywords']['urls'][keyword][link] === undefined) {
              if (mediaMatch === null || mediaMatch[1] === undefined) keywordData['keywords']['urls'][keyword][link] = [title, matches.length, time, description, URI]
              else keywordData['keywords']['urls'][keyword][link] = [title, matches.length, time, description, URI, mediaMatch[1]]
            } else {
              keywordData['keywords']['urls'][keyword][link][0] = title
              keywordData['keywords']['urls'][keyword][link][2] = time
              keywordData['keywords']['urls'][keyword][link][3] = description
              keywordData['keywords']['urls'][keyword][link][4] = URI
              if (mediaMatch !== null && mediaMatch[1] !== undefined) keywordData['keywords']['urls'][keyword][link][5] = mediaMatch[1]
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
  if (data['feedData'] === undefined) data['feedData'] = {}

  for (let url of Object.keys(data['feeds'])) {
    if (data['feedData'][url] === undefined) data['feedData'][url] = {}
  }

  browser.storage.local.set(data)

  if ((data['addon'] === undefined || data['addon']['status'] === undefined) || data['addon']['status'] === 'enabled') {

    if (data['feeds'] === undefined) return
    for (let url of Object.keys(data['feeds'])) {
      browser.alarms.create(url, { 'when': Date.now() + 3000, 'periodInMinutes': data['feeds'][url][1] })
    }

  }
}, errorHandle)