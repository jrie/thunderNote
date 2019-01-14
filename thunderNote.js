// Localization
let getMsg = getFirefoxMessage

function getFirefoxMessage (messageName, params) {
  if (params !== undefined) return browser.i18n.getMessage(messageName, params)
  return browser.i18n.getMessage(messageName)
}

// -------------------------------------------------------------------------------------------------------
function generateZip (rawData) {
  let data = JSON.stringify(rawData)
  let zip = new JSZip()
  zip.file('thunderNote.json', data)

  zip.generateAsync({ 'type': 'blob' }).then(function (blob) {
    let dlLink = document.createElement('a')
    dlLink.href = URL.createObjectURL(blob)

    let dateObj = new Date()
    dlLink.download = 'thunderNote_' + dateObj.getFullYear().toString() + '-' + (dateObj.getMonth() + 1).toString() + '-' + dateObj.getDate().toString() + '.zip'
    document.body.appendChild(dlLink)
    dlLink.click()
    dlLink.parentNode.removeChild(dlLink)
    URL.revokeObjectURL(dlLink.href)
  })
}

// --------------------------------------------------------------------------------------------------------------------------------
function exportSettings () {
  browser.storage.local.get().then(function (data) { generateZip(data) }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
function triggerImport () {
  browser.runtime.getBackgroundPage().then(function (bgPage)  {
    bgPage.document.adoptNode(document.querySelector('#importFile')).addEventListener('change', bgPage.importSettings)
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
// Startup code
// document.querySelector('#importFile').addEventListener('click', triggerImport)

// --------------------------------------------------------------------------------------------------------------------------------
function handleButtons (evt) {
  document.querySelector('.headerControl').classList.remove('inactive')
  for (let page of document.querySelectorAll('.page')) {
    page.classList.remove('active')
  }

  let addButton = document.querySelector('.controlButton[data-cmd="add"]')
  let removalButton = document.querySelector('.controlButton[data-cmd="removeFeed"]')

  switch (evt.target.dataset['cmd']) {
    case 'addItem':
      if (evt.target.dataset['url'] === undefined) {
        document.querySelector('#feedUri').value = ''
        document.querySelector('#feedType').value = 'rss'
        document.querySelector('#feedInterval').value = ''
        removalButton.classList.add('hidden')
        addButton.textContent = getMsg('buttonAddURI')
      } else {
        removalButton.dataset['url'] = evt.target.dataset['url']
        removalButton.classList.remove('hidden')
        addButton.textContent = getMsg('buttonUpdateURI')
      }

      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      document.querySelector('.headerControl').classList.add('inactive')
      break
    case 'add':
      let url = document.querySelector('#feedUri').value
      let type = document.querySelector('#feedType').value
      let crawlTime = parseInt(document.querySelector('#feedInterval').value)

      if (url === '' || isNaN(crawlTime)) {
        document.querySelector('.headerControl').classList.add('inactive')
        document.querySelector('.page[data-src="addItem"]').classList.add('active')
        return
      }

      browser.storage.local.get('feeds').then(function (data) {
        if (data['feeds'] === undefined) data['feeds'] = {}
        data['feeds'][url] = [type, crawlTime]

        browser.storage.local.set(data)
        browser.alarms.create(url, { 'when': Date.now() + 3000, 'periodInMinutes': crawlTime })
      }, errorHandle)
      break
    case 'manageURIs':
      fillURIs()
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      break
    case 'manageKeywords':
      fillKeywords()
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      break
    case 'viewTopics':
      fillTopics()
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      break
    default:
      break
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function errorHandle (error) {
  console.warn(getMsg('errorOccured'))
  console.warn(error)
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeFeed (evt) {
  let feedUri = evt.target.dataset['url']
  browser.storage.local.get('feeds').then(function (data) {
    if (data['feeds'] !== undefined && data['feeds'][feedUri] !== undefined) {
      browser.alarms.clear(feedUri)

      delete data['feeds'][feedUri]
      browser.storage.local.set(data).then(fillURIs)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeKeyword (evt) {
  let feedKeyword = evt.target.dataset['key']
  browser.storage.local.get('keywords').then(function (data) {
    if (data['keywords'] !== undefined && data['keywords']['cnt'][feedKeyword] !== undefined) {
      delete data['keywords']['cnt'][feedKeyword]
      delete data['keywords']['urls'][feedKeyword]
      browser.storage.local.set(data).then(fillKeywords)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillURIs () {
  browser.storage.local.get('feeds').then(function (data) {
    let ul = document.querySelector('#manageURIs')
    ul.innerHTML = ''

    for (let url of Object.keys(data['feeds'])) {
      let li = document.createElement('li')
      let button = document.createElement('button')
      button.value = url
      button.className = 'controlButton removeFeed'
      button.dataset['cmd'] = 'addItem'
      button.dataset['url'] = url

      document.querySelector('#feedUri').value = url
      document.querySelector('#feedType').value = data['feeds'][url][0]
      document.querySelector('#feedInterval').value = data['feeds'][url][1]

      button.appendChild(document.createTextNode(url))
      button.addEventListener('click', handleButtons)
      li.appendChild(button)
      ul.appendChild(li)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillKeywords () {
  browser.storage.local.get('keywords').then(function (data) {
    if (data['keywords'] === undefined) return
    let ul = document.querySelector('#manageKeywords')
    ul.innerHTML = ''

    for (let wordTrigger of Object.keys(data['keywords']['cnt'])) {
      let li = document.createElement('li')
      let button = document.createElement('button')
      button.value = wordTrigger
      button.className = 'controlButton removeKeyword'
      button.dataset['cmd'] = 'removeKeyword'
      button.dataset['key'] = wordTrigger

      button.appendChild(document.createTextNode(wordTrigger))
      button.addEventListener('click', removeKeyword)
      li.appendChild(button)
      ul.appendChild(li)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
function fillTopics () {
  browser.storage.local.get('keywords').then(function (data) {
    if (data['keywords'] === undefined) return
    let rootUl = document.querySelector('#viewTopics')
    rootUl.innerHTML = ''

    let sortedTopics = Object.keys(data['keywords']['cnt']).sort()

    if (Object.keys(data['keywords']['urls']).length === 0) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('h2')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(getMsg('noTopics')))
      li.appendChild(subLine)
      rootUl.appendChild(li)
      return
    }

    for (let keyword of sortedTopics) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('h2')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(keyword))

      let subLineCount = document.createElement('span')
      subLineCount.className = 'subCount'
      subLineCount.appendChild(document.createTextNode(data['keywords']['cnt'][keyword] === 1 ? data['keywords']['cnt'][keyword] + ' item' : data['keywords']['cnt'][keyword] + ' items'))
      subLine.appendChild(subLineCount)
      li.appendChild(subLine)

      if (Object.keys(data['keywords']['urls'][keyword]).length === 0) {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)
        let entryTitle = document.createElement('span')
        entryTitle.className = 'entryTitle'
        entryTitle.appendChild(document.createTextNode('---'))
        subList.appendChild(entryTitle)
      } else  {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)
        for (let key of Object.keys(data['keywords']['urls'][keyword])) {
          let item = data['keywords']['urls'][keyword][key]
          let dateObj = new Date(item[2])

          let entryDate = document.createElement('span')
          entryDate.className = 'entryDate'
          entryDate.appendChild(document.createTextNode(dateObj.toLocaleString()))

          let entryTitle = document.createElement('a')
          entryTitle.href = key
          entryTitle.className = 'entryTitle'
          entryTitle.appendChild(document.createTextNode(item[0]))

          let entryContent = document.createElement('p')
          entryContent.className = 'entryContent'
          entryContent.appendChild(document.createTextNode(item[3]))

          subList.appendChild(entryDate)
          subList.appendChild(entryTitle)
          subList.appendChild(entryContent)
        }
      }

      rootUl.appendChild(li)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
function handleMessage (message) {
  if (message['addKeyword'] !== undefined) {
    fillKeywords()
    browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', message['addKeyword']) })
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function addInputKeyword (evt) {
  if (evt.keyCode !== 13) { return }

  let keywordText = evt.target.value.trim()
  if (keywordText.length === 0) return

  browser.storage.local.get('keywords').then(function (keywordData) {
    if (keywordData['keywords'] === undefined) keywordData['keywords'] = { 'cnt': {}, 'urls': {} }
    if (keywordData['keywords']['cnt'][keywordText] !== undefined) return

    keywordData['keywords']['cnt'][keywordText] = 0
    keywordData['keywords']['urls'][keywordText] = {}
    browser.storage.local.set(keywordData)

    fillKeywords()
    browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', keywordText) })
    evt.target.value = ''
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
// Initial controls
for (let controlButton of document.querySelectorAll('.controlButton')) {
  controlButton.addEventListener('click', handleButtons)
}

for (let backButton of document.querySelectorAll('.backButton')) {
  backButton.addEventListener('click', handleButtons)
}

document.querySelector('.controlButton[data-cmd="removeFeed"]').addEventListener('click', removeFeed)
document.querySelector('#addKeywordInput').addEventListener('keyup', addInputKeyword)

fillKeywords()
fillTopics()

browser.runtime.onMessage.addListener(handleMessage)
