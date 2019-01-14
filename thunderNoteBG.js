/*
  http://www.tagesschau.de/xml/rss2
  http://www.spiegel.de/schlagzeilen/tops/index.rss']
*/

function handleAlarms (evt) {
  handleRSS(evt.name)
}

function handleRSS (URI) {
  let request = new XMLHttpRequest()

  request.addEventListener('readystatechange', function (evt) {
    if (evt.target.readyState === 4) {
      if (evt.target.status === 200) {
        if (processXMLData(evt.target.responseXML)) {
          browser.notifications.create(null, { 'type': 'basic', 'title': 'RSS Update', 'message': URI + ' was updated.' })
          return
        }
      }

      browser.notifications.create(null, { 'type': 'basic', 'title': 'Fetching data error', 'message': URI + ' could not been fetched.' })
    }
  })

  request.timeout = 30000
  request.open('GET', URI)
  request.send()
}

function processXMLData (xmlDoc) {
  let x2js = new X2JS()
  let json = x2js.xml2json(xmlDoc)

  if (json['rss'] === undefined || json['rss']['channel'] === undefined) return false

  browser.storage.local.get('keywords').then(function (keywordData) {
    if (keywordData === undefined) return true

    for (let keyword of Object.keys(keywordData['keywords']['cnt'])) {
      for (let item of json['rss']['channel']['item']) {
        let link = item['link']
        let title = item['title']
        let description = item['description']
        let time = Date.parse(item['pubDate'])

        let itemData = [link, title, description]

        let mediaMatch = item['encoded'].toString().match(/img src='((http|https):\/\/.*\.(jpg|jpeg|png|gif|webm|mp4|tiff))/i)
        if (mediaMatch !== null && mediaMatch[1] !== undefined) {
          itemData.push(mediaMatch[1])
        }

        let keyRegEx = new RegExp(keyword, 'g')

        for (let element of itemData) {
          let matches = element.match(keyRegEx)

          if (matches !== null) {
            if (keywordData['keywords']['urls'][keyword] === undefined) keywordData['keywords']['urls'][keyword] = {}
            if (keywordData['keywords']['urls'][keyword][link] === undefined) keywordData['keywords']['urls'][keyword][link] = [title, matches.length, time, description]
            else {
              keywordData['keywords']['urls'][keyword][link][0] = title
              keywordData['keywords']['urls'][keyword][link][2] = time
              keywordData['keywords']['urls'][keyword][link][3] = description
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

function errorHandle (error) {
  console.warn('An error occured:')
  console.warn(error)
}

browser.alarms.onAlarm.addListener(handleAlarms)
browser.contextMenus.create({ title: 'Add news keyword', documentUrlPatterns: ['*://*/*'], contexts: ['link', 'selection'], onclick (info) { browser.storage.local.get('keywords').then(function (data) { addKeyword(data, info) }, errorHandle) } })

browser.storage.local.get('feeds').then(function (data) {
  browser.alarms.clearAll()
  for (let url of Object.keys(data['feeds'])) {
    browser.alarms.create(url, { 'when': Date.now() + 5000, 'periodInMinutes': data['feeds'][url][1] })
  }
}, errorHandle)