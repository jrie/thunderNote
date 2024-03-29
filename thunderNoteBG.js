// Localization
function getFirefoxMessage (messageName, params) {
  if (params !== undefined) return browser.i18n.getMessage(messageName, params)
  return browser.i18n.getMessage(messageName)
}

const getMsg = getFirefoxMessage

// -------------------------------------------------------------------------------------------------------

function handleAlarms (evt) {
  browser.storage.local.get('feeds').then(function (data) {
    if (data.feeds === undefined) return

    if (data.feeds[evt.name][0] === 'rss') handleRSS(evt.name)
    // TODO: else => handleWebpage
  }, errorHandle)
}

// -------------------------------------------------------------------------------------------------------

function handleRSS (URI) {
  const request = new XMLHttpRequest()
  request.addEventListener('readystatechange', function (evt) {
    if (evt.target.readyState === 4) {
      if (evt.target.status === 200 || evt.target.status === 304) {
        let xml = evt.target.responseXML
        if (xml === null) {
          const xmlParser = new DOMParser()
          xml = xmlParser.parseFromString(evt.target.response, 'text/xml')
        }

        if (processXMLData(xml, URI)) return
      }

      browser.storage.local.get('addon').then(function (data) {
        if (data.addon.notifications === 'enabled') browser.notifications.create(null, { type: 'basic', iconUrl: 'icons/thunderNote.svg', title: getMsg('RSSupdateFailTitle'), message: getMsg('RSSupdateError', URI) })
      })
    }
  })

  request.timeout = 40000
  request.open('GET', URI)
  request.send()
}

// -------------------------------------------------------------------------------------------------------
function processXMLData (xmlDoc, URI) {
  if (xmlDoc === null) {
    browser.storage.local.get('addon').then(function (data) {
      if (data.addon.notifications === 'enabled') browser.notifications.create(null, { type: 'basic', iconUrl: 'icons/thunderNote.svg', title: getMsg('RSSupdateFailTitle'), message: getMsg('RSSupdateError', URI) })
    })

    return false
  }

  const x2js = new X2JS()
  let json

  try {
    json = x2js.xml2json(xmlDoc)
  } catch (error) {
    browser.notifications.create(null, { type: 'basic', iconUrl: 'icons/thunderNote.svg', title: getMsg('RSSupdateFailTitle'), message: getMsg('RSSupdateError', URI) })
    console.warn(getMsg('RSSupdateError', URI))
    console.warn(error)
    return false
  }

  let jsonData
  if (json.channel !== undefined) {
    jsonData = json.channel
  } else if (json.rss !== undefined || json.rss.channel !== undefined) {
    jsonData = json.rss.channel
  }

  if (jsonData.item === undefined) {
    return false
  }

  browser.storage.local.get().then(function (data) {
    if (data.feedData === undefined) data.feedData = {}
    if (data.feedData[URI] === undefined) data.feedData[URI] = {}

    let refreshTime = 0
    for (const item of jsonData.item) {
      const link = item.link
      const title = item.title
      const description = item.description
      const time = Date.parse(item.pubDate)

      if (refreshTime === 0 || refreshTime < time) refreshTime = time

      if (data.feedData[URI][link] === undefined) {
        data.feedData[URI][link] = [title, time, description, link, null]
      } else {
        data.feedData[URI][link][0] = title
        data.feedData[URI][link][1] = time
        data.feedData[URI][link][2] = description
        data.feedData[URI][link][3] = link
        data.feedData[URI][link][4] = null
      }

      let mediaMatch = null
      if (item.enclosure !== undefined) {
        if (item.enclosure._url !== undefined) data.feedData[URI][link][4] = item.enclosure._url
      } else if (item.encoded !== undefined) {
        mediaMatch = item.encoded.toString().match(/img.*src=["']((http|https):\/\/.*\.(jpg|jpeg|png|gif|webm|mp4|tiff))/i)
        if (mediaMatch !== null && mediaMatch[1] !== undefined) data.feedData[URI][link][4] = mediaMatch[1]
      }
    }

    if (data.feeds[URI][3] === undefined) {
      data.feeds[URI].push(refreshTime)
      if (data.addon.notifications === 'enabled') browser.notifications.create(null, { type: 'basic', iconUrl: 'icons/thunderNote.svg', title: getMsg('RSSnewTitle'), message: getMsg('RSSnewInformation', URI) })
    } else {
      if (data.feeds[URI][3] !== refreshTime) {
        if (data.addon.notifications === 'enabled') browser.notifications.create(null, { type: 'basic', iconUrl: 'icons/thunderNote.svg', title: getMsg('RSSnewTitle'), message: getMsg('RSSnewInformation', URI) })
      }
      data.feeds[URI][3] = refreshTime
    }

    browser.storage.local.set(data)
  })

  browser.storage.local.get('keywords').then(function (keywordData) {
    if (keywordData === undefined) return true
    if (keywordData.keywords === undefined) return true

    for (const keyword of Object.keys(keywordData.keywords.cnt)) {
      for (const item of jsonData.item) {
        const link = item.link
        const title = item.title
        const description = item.description
        const time = Date.parse(item.pubDate)

        const itemData = [link, title, description]
        let mediaMatch = null
        if (item.encoded !== undefined) {
          itemData.push(item.encoded.toString())
          mediaMatch = item.encoded.toString().match(/img src=["']((http|https):\/\/.*\.(jpg|jpeg|png|gif|webm|mp4|tiff))/i)
        }

        const keyRegEx = new RegExp(keyword, 'gm')

        for (const element of itemData) {
          const matches = element.match(keyRegEx)

          if (matches !== null) {
            if (keywordData.keywords.urls[keyword] === undefined) keywordData.keywords.urls[keyword] = {}
            if (keywordData.keywords.urls[keyword][link] === undefined) {
              if (mediaMatch === null || mediaMatch[1] === undefined) keywordData.keywords.urls[keyword][link] = [title, matches.length, time, description, URI]
              else keywordData.keywords.urls[keyword][link] = [title, matches.length, time, description, URI, mediaMatch[1]]
            } else {
              keywordData.keywords.urls[keyword][link][0] = title
              keywordData.keywords.urls[keyword][link][2] = time
              keywordData.keywords.urls[keyword][link][3] = description
              keywordData.keywords.urls[keyword][link][4] = URI
              if (mediaMatch !== null && mediaMatch[1] !== undefined) keywordData.keywords.urls[keyword][link][5] = mediaMatch[1]
            }
          }
        }
      }

      keywordData.keywords.cnt[keyword] = Object.keys(keywordData.keywords.urls[keyword]).length
      browser.storage.local.set(keywordData)
    }
  }, errorHandle)

  return true
}

// -------------------------------------------------------------------------------------------------------

function addKeyword (keywordData, info) {
  if (keywordData.keywords === undefined) keywordData.keywords = { cnt: {}, urls: {} }
  let keywordText = info.linkText !== undefined ? info.linkText : info.selectionText
  keywordText = keywordText.trim()

  if (keywordText.length === 0) return
  if (keywordData.keywords.cnt[keywordText] !== undefined) return

  keywordData.keywords.cnt[keywordText] = 0

  if (keywordData.keywords.urls === undefined) keywordData.keywords.urls = {}
  browser.storage.local.set(keywordData)
  browser.runtime.sendMessage({ addKeyword: keywordText })
}

// -------------------------------------------------------------------------------------------------------

function errorHandle (error) {
  console.warn('An error occured:')
  console.warn(error)
}

// -------------------------------------------------------------------------------------------------------
browser.alarms.onAlarm.addListener(handleAlarms)
browser.contextMenus.create({ title: getMsg('contextMenuToggleThunderNote'), contexts: ['all'], command: '_execute_sidebar_action' })
browser.contextMenus.create({ title: getMsg('contextMenuAddKeyword'), contexts: ['link', 'selection'], onclick (info) { browser.storage.local.get('keywords').then(function (data) { addKeyword(data, info) }, errorHandle) } })
browser.contextMenus.create({ title: getMsg('contextMenuHighlightOn'), contexts: ['all'], onclick (info) { browser.find.highlightResults() } })
browser.contextMenus.create({ title: getMsg('contextMenuHighlightOff'), contexts: ['all'], onclick (info) { browser.find.removeHighlighting() } })

browser.storage.local.get().then(function (data) {
  browser.alarms.clearAll()
  if (data.feedData === undefined) data.feedData = {}
  if (data.feeds === undefined) return

  for (const url of Object.keys(data.feeds)) {
    if (data.feedData[url] === undefined) data.feedData[url] = {}
  }

  browser.storage.local.set(data)

  if ((data.addon === undefined || data.addon.status === undefined) || data.addon.status === 'enabled') {
    for (const url of Object.keys(data.feeds)) {
      browser.alarms.create(url, { when: Date.now() + 3000, periodInMinutes: data.feeds[url][1] })
    }
  }
}, errorHandle)

// -------------------------------------------------------------------------------------------------------

browser.runtime.onInstalled.addListener(async ({ reason, temporary }) => {
  if (temporary) return

  switch (reason) {
    case 'install':
      browser.tabs.create({ url: browser.runtime.getURL('postInstall.html') })
      break
    case 'update':
      browser.tabs.create({ url: browser.runtime.getURL('postUpdate.html') })
      break
    default:
      break
  }
})

// -------------------------------------------------------------------------------------------------------

browser.browserAction.onClicked.addListener(function () {
  browser.sidebarAction.toggle()
})
